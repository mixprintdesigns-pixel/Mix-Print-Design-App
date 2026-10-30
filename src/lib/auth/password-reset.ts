import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { defaultTransports, generateCode } from "@/lib/affiliate/verification";
import type { EmailTransport } from "@/lib/email";
import { hashPassword } from "./password";
import { isBootstrapAdmin } from "./service";

// "Forgot password": a 6-digit code is emailed, and the visitor sets a new password with it.
// Because the code proves the inbox belongs to them, an email listed in ADMIN_EMAILS also becomes
// an administrator here (and the account is created if it does not exist yet). Nothing is deleted.

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const RESET_MAX_ATTEMPTS = 5;
const REQUESTS_PER_EMAIL_PER_HOUR = 5;
const REQUESTS_PER_IP_PER_HOUR = 20;

function secret(): string {
  return process.env.OTP_SECRET ?? process.env.APP_SECRET ?? "mixprint-otp";
}

function hashResetCode(resetId: string, code: string): string {
  return createHmac("sha256", secret()).update(`reset:${resetId}:${code}`).digest("hex");
}

export class ResetError extends Error {}

/**
 * Sends a reset code when the email belongs to an account (or is an ADMIN_EMAILS address).
 * Unknown emails get the same response, so the form does not reveal who has an account.
 */
export async function requestPasswordReset(
  email: string,
  meta: { ip?: string | null } = {},
  transport: EmailTransport = defaultTransports().email,
  now = new Date(),
): Promise<void> {
  const hour = 60 * 60 * 1000;
  if (!(await rateLimit(`pw-reset-ip:${meta.ip ?? "unknown"}`, REQUESTS_PER_IP_PER_HOUR, hour, now)).allowed) {
    throw new ResetError("Too many requests from your connection. Please try again in an hour.");
  }
  if (!(await rateLimit(`pw-reset:${email}`, REQUESTS_PER_EMAIL_PER_HOUR, hour, now)).allowed) {
    throw new ResetError("Too many codes were requested for this email. Please try again in an hour.");
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { name: true } });
  if (!user && !isBootstrapAdmin(email)) return;

  // A new code replaces any earlier unused one.
  await prisma.passwordReset.updateMany({ where: { email, usedAt: null }, data: { expiresAt: now } });
  const code = generateCode();
  const reset = await prisma.passwordReset.create({
    data: { email, codeHash: "pending", expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS) },
  });
  await prisma.passwordReset.update({ where: { id: reset.id }, data: { codeHash: hashResetCode(reset.id, code) } });

  const result = await transport({
    to: email,
    subject: `${code} is your Mix Print Design password reset code`,
    text:
      `Assalam o Alaikum${user ? ` ${user.name}` : ""},\n\n` +
      `Your Mix Print Design password reset code is: ${code}\n\n` +
      `It expires in 15 minutes. If you did not ask to reset your password, ignore this email; your password stays the same.`,
  });
  if (!result.sent) {
    console.error(`Password reset email not sent: ${result.error}`);
    throw new ResetError("We couldn't send the email right now. Please try again in a few minutes.");
  }
}

export type ResetOutcome = { ok: true; userId: string; role: string } | { ok: false; message: string };

/** Checks the code and, if it matches, saves the new password and signs out the account's other devices. */
export async function resetPassword(email: string, code: string, newPassword: string, now = new Date()): Promise<ResetOutcome> {
  const reset = await prisma.passwordReset.findFirst({ where: { email, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!reset || reset.expiresAt <= now) {
    return { ok: false, message: "This code has expired. Please ask for a new one." };
  }
  if (reset.attempts >= RESET_MAX_ATTEMPTS) {
    return { ok: false, message: "Too many wrong tries. Please ask for a new code." };
  }

  const expected = Buffer.from(reset.codeHash, "hex");
  const given = Buffer.from(hashResetCode(reset.id, code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const used = reset.attempts + 1;
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: used } });
    const left = RESET_MAX_ATTEMPTS - used;
    return { ok: false, message: left > 0 ? `That code is not correct. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Please ask for a new code." };
  }

  const passwordHash = await hashPassword(newPassword);
  const makeAdmin = isBootstrapAdmin(email);
  const user = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) throw new ResetError("This code has already been used. Please ask for a new one.");
    const saved = await tx.user.upsert({
      where: { email },
      create: { email, name: "Mix Print Design", passwordHash, emailVerifiedAt: now, role: makeAdmin ? "ADMIN" : "CUSTOMER" },
      update: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(makeAdmin ? { role: "ADMIN" as const } : {}),
      },
      select: { id: true, role: true, emailVerifiedAt: true },
    });
    if (!saved.emailVerifiedAt) await tx.user.update({ where: { id: saved.id }, data: { emailVerifiedAt: now } });
    // Sign out every other device (the sessions are expired, not deleted).
    await tx.session.updateMany({ where: { userId: saved.id, expiresAt: { gt: now } }, data: { expiresAt: now } });
    return saved;
  });
  return { ok: true, userId: user.id, role: user.role };
}
