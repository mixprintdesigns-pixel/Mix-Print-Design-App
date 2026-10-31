import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/crypto";
import { resendTransport, type EmailTransport } from "@/lib/email";
import { twilioTransport, type SmsTransport } from "@/lib/sms";
import { devOutboxEnabled, writeDevOutbox } from "@/lib/dev-outbox";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, applyAsAffiliate } from "./service";
import type { PayoutMethodValue } from "./validation";

// Affiliate signup verification: a 6-digit code by email and a separate one by SMS.
// Nothing is activated until both are confirmed. While SMS is not set up
// (SMS_VERIFICATION_ENABLED is not "true"), only the email code is sent and checked; the mobile
// number is still saved for payouts, but it is not marked as verified.

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_WAIT_MS = 60 * 1000;
export const MAX_RESENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5;
const SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;
const SIGNUPS_PER_IP_PER_HOUR = 10;

export type Channel = "email" | "phone";

/** SMS codes are used only when SMS_VERIFICATION_ENABLED=true. */
export function smsVerificationEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SMS_VERIFICATION_ENABLED?.trim().toLowerCase() === "true";
}

/** A problem to show the visitor in plain language; `field` points at the input. */
export class VerificationError extends Error {
  constructor(
    message: string,
    public field = "_form",
  ) {
    super(message);
  }
}

export type Transports = { email: EmailTransport; sms: SmsTransport };

/** Real providers, or the local test outbox when OTP_DEV_OUTBOX=true and a provider has no keys. */
export function defaultTransports(): Transports {
  const outbox = devOutboxEnabled();
  return {
    email:
      outbox && !process.env.RESEND_API_KEY
        ? async (e) => (await writeDevOutbox({ channel: "email", to: e.to, body: e.text }), { sent: true })
        : resendTransport,
    sms:
      outbox && !process.env.TWILIO_ACCOUNT_SID
        ? async (s) => (await writeDevOutbox({ channel: "sms", to: s.to, body: s.body }), { sent: true })
        : twilioTransport,
  };
}

// ─── Codes ───────────────────────────────────────────────────────────────────

function secret(): string {
  return process.env.OTP_SECRET ?? process.env.APP_SECRET ?? "mixprint-otp";
}

/** Keyed hash bound to the signup and channel, so a code is useless anywhere else. */
export function hashCode(signupId: string, channel: Channel, code: string): string {
  return createHmac("sha256", secret()).update(`${signupId}:${channel}:${code}`).digest("hex");
}

function codesMatch(stored: string, signupId: string, channel: Channel, code: string): boolean {
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(hashCode(signupId, channel, code), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"*".repeat(Math.max(user.length - 1, 2))}@${domain}`;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}******${phone.slice(-3)}`;
}

// ─── Starting a signup ───────────────────────────────────────────────────────

export type SignupInput = {
  userId?: string; // signed-in customer joining the program
  passwordHash?: string; // new account
  name: string;
  email: string;
  phone: string; // E.164
  application: {
    payoutMethod: PayoutMethodValue;
    payoutAccount: string;
    payoutAccountName: string;
    website: string | null;
    promotionPlan: string;
  };
};

/** Email or mobile number already belongs to a different account? */
async function assertAvailable(email: string, phone: string, userId?: string): Promise<void> {
  const [byEmail, byPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findFirst({ where: { phone, ...(userId ? { id: { not: userId } } : {}) }, select: { id: true } }),
  ]);
  if (byEmail && byEmail.id !== userId) {
    throw new VerificationError("This email is already registered. Please sign in, then join the affiliate program.", "email");
  }
  if (byPhone) throw new VerificationError("This mobile number is already used by another account.", "phone");
}

export type StartResult = { token: string; signupId: string; completed: boolean };

/**
 * Saves a pending signup and sends the codes. For signed-in customers whose email and mobile are
 * already verified, the application is submitted straight away (completed: true).
 */
export async function startSignup(
  input: SignupInput,
  meta: { ip?: string | null } = {},
  transports: Transports = defaultTransports(),
  now = new Date(),
): Promise<StartResult> {
  if (!(await rateLimit(`aff-signup:${meta.ip ? hashIp(meta.ip) : "unknown"}`, SIGNUPS_PER_IP_PER_HOUR, 60 * 60 * 1000, now)).allowed) {
    throw new VerificationError("Too many signup attempts from your connection. Please try again in an hour.");
  }
  await assertAvailable(input.email, input.phone, input.userId);

  const user = input.userId
    ? await prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true } })
    : null;
  const emailAlreadyVerified = Boolean(user?.emailVerifiedAt && user.email === input.email);
  const phoneAlreadyVerified = Boolean(user?.phoneVerifiedAt && user.phone === input.phone);
  const needsPhoneCode = smsVerificationEnabled() && !phoneAlreadyVerified;

  // Starting again replaces any unfinished signup for the same person.
  await prisma.affiliateSignup.deleteMany({
    where: { completedAt: null, OR: [{ email: input.email }, ...(input.userId ? [{ userId: input.userId }] : [])] },
  });

  const token = generateToken();
  const signup = await prisma.affiliateSignup.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId ?? null,
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash ?? null,
      ...input.application,
      emailVerifiedAt: emailAlreadyVerified ? now : null,
      phoneVerifiedAt: phoneAlreadyVerified ? now : null,
      expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS),
    },
  });

  if (emailAlreadyVerified && !needsPhoneCode) {
    await completeSignup(signup.id, now);
    return { token, signupId: signup.id, completed: true };
  }

  try {
    if (!emailAlreadyVerified) await deliverCode(signup.id, "email", transports, now, { initial: true });
    if (needsPhoneCode) await deliverCode(signup.id, "phone", transports, now, { initial: true });
  } catch (error) {
    await prisma.affiliateSignup.delete({ where: { id: signup.id } }).catch(() => {});
    throw error;
  }
  return { token, signupId: signup.id, completed: false };
}

// ─── Sending and resending ───────────────────────────────────────────────────

async function deliverCode(signupId: string, channel: Channel, transports: Transports, now: Date, opts: { initial?: boolean } = {}) {
  const signup = await prisma.affiliateSignup.findUniqueOrThrow({ where: { id: signupId } });
  const lastSent = channel === "email" ? signup.emailLastSentAt : signup.phoneLastSentAt;
  if (lastSent && now.getTime() - lastSent.getTime() < RESEND_WAIT_MS) {
    const seconds = Math.ceil((RESEND_WAIT_MS - (now.getTime() - lastSent.getTime())) / 1000);
    throw new VerificationError(`Please wait ${seconds} seconds before asking for a new code.`, channel);
  }
  // Counted per destination, so starting a new signup doesn't reset the limit.
  const destination = channel === "email" ? signup.email : signup.phone;
  const allowed = await rateLimit(`otp-send:${channel}:${destination}`, MAX_RESENDS_PER_HOUR + 1, 60 * 60 * 1000, now);
  if (!allowed.allowed) {
    throw new VerificationError("You have asked for too many codes. Please try again in an hour.", channel);
  }

  const code = generateCode();
  const result =
    channel === "email"
      ? await transports.email({
          to: signup.email,
          subject: `${code} is your Mix Print Design verification code`,
          text: `Assalam o Alaikum ${signup.name},\n\nYour Mix Print Design affiliate verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.`,
        })
      : await transports.sms({ to: signup.phone, body: `Mix Print Design code: ${code}. Valid for 10 minutes. Do not share it with anyone.` });

  if (!result.sent) {
    console.error(`Verification ${channel} not sent: ${result.error}`);
    throw new VerificationError(
      channel === "email"
        ? "We couldn't send the email code right now. Please try again in a few minutes."
        : "We couldn't send the SMS code right now. Please check the number or try again in a few minutes.",
      opts.initial ? "_form" : channel,
    );
  }

  const fields =
    channel === "email"
      ? { emailCodeHash: hashCode(signupId, "email", code), emailCodeExpiresAt: new Date(now.getTime() + CODE_TTL_MS), emailAttempts: 0, emailLastSentAt: now }
      : { phoneCodeHash: hashCode(signupId, "phone", code), phoneCodeExpiresAt: new Date(now.getTime() + CODE_TTL_MS), phoneAttempts: 0, phoneLastSentAt: now };
  await prisma.affiliateSignup.update({ where: { id: signupId }, data: fields });
}

async function findActive(token: string, now: Date) {
  const signup = await prisma.affiliateSignup.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!signup || signup.completedAt || signup.expiresAt <= now) {
    throw new VerificationError("This signup has expired. Please fill in the form again.");
  }
  return signup;
}

export async function resendCode(token: string, channel: Channel, transports: Transports = defaultTransports(), now = new Date()) {
  const signup = await findActive(token, now);
  if (channel === "phone" && !smsVerificationEnabled()) throw new VerificationError("SMS codes are not used right now.", channel);
  if ((channel === "email" ? signup.emailVerifiedAt : signup.phoneVerifiedAt) !== null) {
    throw new VerificationError(channel === "email" ? "Your email is already verified." : "Your mobile number is already verified.", channel);
  }
  await deliverCode(signup.id, channel, transports, now);
}

// ─── Checking codes ──────────────────────────────────────────────────────────

export type CodeOutcome = "verified" | "wrong" | "expired" | "blocked" | "missing";
export type VerifyResult =
  | { done: true; userId: string; isNewAccount: boolean }
  | { done: false; email: CodeOutcome; phone: CodeOutcome; attemptsLeft: { email: number; phone: number } };

/** Plain-language message for a code result, shown under the input. */
export function outcomeMessage(outcome: CodeOutcome, attemptsLeft: number): string | null {
  switch (outcome) {
    case "verified":
      return null;
    case "wrong":
      return `That code is not correct. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`;
    case "expired":
      return "This code has expired. Tap “Resend code” to get a new one.";
    case "blocked":
      return "Too many wrong tries. Tap “Resend code” to get a new code.";
    case "missing":
      return "Enter the 6-digit code.";
  }
}

async function checkChannel(
  signup: Awaited<ReturnType<typeof findActive>>,
  channel: Channel,
  code: string,
  now: Date,
): Promise<{ outcome: CodeOutcome; attemptsLeft: number }> {
  const verifiedAt = channel === "email" ? signup.emailVerifiedAt : signup.phoneVerifiedAt;
  if (verifiedAt) return { outcome: "verified", attemptsLeft: MAX_ATTEMPTS };
  const hash = channel === "email" ? signup.emailCodeHash : signup.phoneCodeHash;
  const expires = channel === "email" ? signup.emailCodeExpiresAt : signup.phoneCodeExpiresAt;
  const attempts = channel === "email" ? signup.emailAttempts : signup.phoneAttempts;

  if (!hash || attempts >= MAX_ATTEMPTS) return { outcome: "blocked", attemptsLeft: 0 };
  if (!expires || expires <= now) return { outcome: "expired", attemptsLeft: 0 };
  if (!/^\d{6}$/.test(code)) return { outcome: "missing", attemptsLeft: MAX_ATTEMPTS - attempts };

  if (codesMatch(hash, signup.id, channel, code)) {
    await prisma.affiliateSignup.update({
      where: { id: signup.id },
      data: channel === "email" ? { emailVerifiedAt: now, emailCodeHash: null } : { phoneVerifiedAt: now, phoneCodeHash: null },
    });
    return { outcome: "verified", attemptsLeft: MAX_ATTEMPTS };
  }

  const used = attempts + 1;
  const blocked = used >= MAX_ATTEMPTS;
  // After the last wrong try the code is deleted, so it can never be guessed; a new one must be requested.
  await prisma.affiliateSignup.update({
    where: { id: signup.id },
    data:
      channel === "email"
        ? { emailAttempts: used, ...(blocked ? { emailCodeHash: null } : {}) }
        : { phoneAttempts: used, ...(blocked ? { phoneCodeHash: null } : {}) },
  });
  return { outcome: blocked ? "blocked" : "wrong", attemptsLeft: MAX_ATTEMPTS - used };
}

/** Checks both codes. When both are verified, creates/activates the account and submits the application. */
export async function verifyCodes(token: string, codes: { email: string; phone: string }, now = new Date()): Promise<VerifyResult> {
  const signup = await findActive(token, now);
  const email = await checkChannel(signup, "email", codes.email.trim(), now);
  const phone = smsVerificationEnabled()
    ? await checkChannel(signup, "phone", codes.phone.trim(), now)
    : { outcome: "verified" as const, attemptsLeft: MAX_ATTEMPTS };
  if (email.outcome === "verified" && phone.outcome === "verified") {
    return { done: true, ...(await completeSignup(signup.id, now)) };
  }
  return { done: false, email: email.outcome, phone: phone.outcome, attemptsLeft: { email: email.attemptsLeft, phone: phone.attemptsLeft } };
}

/**
 * Creates (or updates) the account with the verified email and the mobile number, then submits the
 * affiliate application. The number is marked verified only if it was confirmed by SMS.
 */
async function completeSignup(signupId: string, now: Date): Promise<{ userId: string; isNewAccount: boolean }> {
  const signup = await prisma.affiliateSignup.findUniqueOrThrow({ where: { id: signupId } });
  if (!signup.emailVerifiedAt || (smsVerificationEnabled() && !signup.phoneVerifiedAt)) throw new Error("Signup is not fully verified");
  // Someone may have registered the same email or number while this signup was pending.
  await assertAvailable(signup.email, signup.phone, signup.userId ?? undefined);

  const userId = await prisma.$transaction(async (tx) => {
    const verified = { emailVerifiedAt: signup.emailVerifiedAt, phoneVerifiedAt: signup.phoneVerifiedAt, phone: signup.phone };
    const id = signup.userId
      ? (await tx.user.update({ where: { id: signup.userId }, data: verified, select: { id: true } })).id
      : (
          await tx.user.create({
            data: { name: signup.name, email: signup.email, passwordHash: signup.passwordHash!, ...verified },
            select: { id: true },
          })
        ).id;
    await tx.affiliateSignup.update({ where: { id: signup.id }, data: { completedAt: now, userId: id, passwordHash: null } });
    return id;
  });

  await applyAsAffiliate(userId, {
    payoutMethod: signup.payoutMethod,
    payoutAccount: signup.payoutAccount,
    payoutAccountName: signup.payoutAccountName,
    website: signup.website,
    promotionPlan: signup.promotionPlan,
  });
  return { userId, isNewAccount: !signup.userId };
}

/** What the verification screen needs to know, or null if there is no active signup. */
export async function getSignupStatus(token: string | null | undefined, now = new Date()) {
  if (!token) return null;
  const signup = await prisma.affiliateSignup.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!signup || signup.completedAt || signup.expiresAt <= now) return null;
  const wait = (last: Date | null) => (last ? Math.max(0, Math.ceil((RESEND_WAIT_MS - (now.getTime() - last.getTime())) / 1000)) : 0);
  return {
    email: maskEmail(signup.email),
    phone: maskPhone(signup.phone),
    needsEmail: !signup.emailVerifiedAt,
    needsPhone: smsVerificationEnabled() && !signup.phoneVerifiedAt,
    emailResendIn: wait(signup.emailLastSentAt),
    phoneResendIn: wait(signup.phoneLastSentAt),
  };
}

/** Pending signups older than a day are deleted; safe to call any time. */
export async function cleanupExpiredSignups(now = new Date()): Promise<number> {
  const { count } = await prisma.affiliateSignup.deleteMany({ where: { completedAt: null, expiresAt: { lt: now } } });
  return count;
}

