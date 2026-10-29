import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { registerUser } from "@/lib/auth/service";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  maskEmail,
  maskPhone,
  resendCode,
  startSignup,
  verifyCodes,
  VerificationError,
  type SignupInput,
  type Transports,
} from "@/lib/affiliate/verification";
import { resetDatabase } from "../support/db";

/** Captures messages instead of sending them, and exposes the latest codes. */
function inbox() {
  const sent: { channel: "email" | "sms"; to: string; body: string }[] = [];
  const transports: Transports = {
    email: async (e) => (sent.push({ channel: "email", to: e.to, body: `${e.subject}\n${e.text}` }), { sent: true }),
    sms: async (s) => (sent.push({ channel: "sms", to: s.to, body: s.body }), { sent: true }),
  };
  const code = (channel: "email" | "sms") => sent.filter((m) => m.channel === channel).at(-1)?.body.match(/\b(\d{6})\b/)?.[1] ?? "";
  return { sent, transports, code };
}

let n = 0;
const T0 = new Date("2026-11-01T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

async function input(overrides: Partial<SignupInput> = {}): Promise<SignupInput> {
  n++;
  return {
    name: "Sana Malik",
    email: `sana${n}@gmail.com`,
    phone: `+92300${String(1000000 + n).slice(-7)}`,
    passwordHash: await hashPassword("MixPrint2026!"),
    application: { payoutMethod: "JAZZCASH", payoutAccount: "+923001234567", payoutAccountName: "Sana Malik", website: null, promotionPlan: "Instagram page" },
    ...overrides,
  };
}

beforeEach(resetDatabase);

describe("new affiliate signup", () => {
  it("sends both codes, stores only hashes, and creates nothing until both are verified", async () => {
    const box = inbox();
    const data = await input();
    const { token, completed } = await startSignup(data, { ip: "1.1.1.1" }, box.transports, T0);
    expect(completed).toBe(false);
    expect(box.sent.map((m) => [m.channel, m.to])).toEqual([
      ["email", data.email],
      ["sms", data.phone],
    ]);
    const emailCode = box.code("email");
    const smsCode = box.code("sms");
    expect(emailCode).toMatch(/^\d{6}$/);
    expect(smsCode).toMatch(/^\d{6}$/);

    const row = await prisma.affiliateSignup.findFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain(emailCode);
    expect(JSON.stringify(row)).not.toContain(smsCode);
    expect(row.tokenHash).not.toBe(token);
    expect(await prisma.user.count()).toBe(0);

    // Only the email code correct: still nothing created
    const half = await verifyCodes(token, { email: emailCode, phone: "000000" === smsCode ? "111111" : "000000" }, at(1000));
    expect(half).toMatchObject({ done: false, email: "verified", phone: "wrong", attemptsLeft: { phone: MAX_ATTEMPTS - 1 } });
    expect(await prisma.user.count()).toBe(0);

    // Email stays verified; now the SMS code completes the signup
    const done = await verifyCodes(token, { email: "", phone: smsCode }, at(2000));
    expect(done).toMatchObject({ done: true, isNewAccount: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: data.email }, include: { affiliate: true } });
    expect(user).toMatchObject({ phone: data.phone, role: "CUSTOMER" });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.affiliate).toMatchObject({ status: "PENDING", payoutMethod: "JAZZCASH", promotionPlan: "Instagram page" });
    expect((await prisma.affiliateSignup.findFirstOrThrow()).passwordHash).toBeNull();

    await expect(verifyCodes(token, { email: emailCode, phone: smsCode })).rejects.toThrow(/expired/);
  });

  it("rejects expired codes", async () => {
    const box = inbox();
    const { token } = await startSignup(await input(), {}, box.transports, T0);
    const result = await verifyCodes(token, { email: box.code("email"), phone: box.code("sms") }, at(CODE_TTL_MS + 1));
    expect(result).toMatchObject({ done: false, email: "expired", phone: "expired" });
  });

  it("blocks a code after 5 wrong tries until a new one is requested", async () => {
    const box = inbox();
    const { token } = await startSignup(await input(), {}, box.transports, T0);
    const right = box.code("sms");
    const wrong = right === "123456" ? "654321" : "123456";
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(await verifyCodes(token, { email: "", phone: wrong }, at(i * 1000))).toMatchObject({ phone: "wrong", attemptsLeft: { phone: MAX_ATTEMPTS - i } });
    }
    expect(await verifyCodes(token, { email: "", phone: wrong }, at(10_000))).toMatchObject({ phone: "blocked" });
    // Even the right code no longer works
    expect(await verifyCodes(token, { email: "", phone: right }, at(11_000))).toMatchObject({ phone: "blocked" });

    await resendCode(token, "phone", box.transports, at(70_000));
    const fresh = box.code("sms");
    expect(await verifyCodes(token, { email: box.code("email"), phone: fresh }, at(71_000))).toMatchObject({ done: true });
  });

  it("enforces a 60-second wait and at most 5 resends per hour", async () => {
    const box = inbox();
    const { token } = await startSignup(await input(), {}, box.transports, T0);
    await expect(resendCode(token, "email", box.transports, at(30_000))).rejects.toThrow(/wait 30 seconds/);
    for (let i = 1; i <= 5; i++) await resendCode(token, "email", box.transports, at(i * 61_000));
    await expect(resendCode(token, "email", box.transports, at(7 * 61_000))).rejects.toThrow(/too many codes/);
    expect(box.sent.filter((m) => m.channel === "email")).toHaveLength(6);
    // A new code replaces the old one
    const first = box.sent.find((m) => m.channel === "email")!.body.match(/\b(\d{6})\b/)![1];
    const latest = box.code("email");
    if (first !== latest) {
      expect(await verifyCodes(token, { email: first, phone: "" }, at(7 * 61_000))).toMatchObject({ email: "wrong" });
    }
  });

  it("blocks emails and mobile numbers already used by another account", async () => {
    const existing = await registerUser({ name: "Old", email: "taken@gmail.com", phone: "+923331112223", password: "password123" });
    expect(existing.id).toBeTruthy();
    const box = inbox();
    await expect(startSignup(await input({ email: "taken@gmail.com" }), {}, box.transports, T0)).rejects.toMatchObject({ field: "email" });
    await expect(startSignup(await input({ phone: "+923331112223" }), {}, box.transports, T0)).rejects.toMatchObject({ field: "phone" });
    expect(box.sent).toHaveLength(0);
  });

  it("re-checks availability when completing, in case someone registered meanwhile", async () => {
    const box = inbox();
    const data = await input();
    const { token } = await startSignup(data, {}, box.transports, T0);
    await registerUser({ name: "Fast", email: data.email, phone: undefined, password: "password123" });
    await expect(verifyCodes(token, { email: box.code("email"), phone: box.code("sms") }, at(1000))).rejects.toThrow(VerificationError);
  });

  it("does not keep the signup if the SMS cannot be sent", async () => {
    const box = inbox();
    box.transports.sms = async () => ({ sent: false, error: "no credit" });
    await expect(startSignup(await input(), {}, box.transports, T0)).rejects.toThrow(/couldn't send the SMS/);
    expect(await prisma.affiliateSignup.count()).toBe(0);
  });

  it("limits signups per connection", async () => {
    const box = inbox();
    for (let i = 0; i < 10; i++) await startSignup(await input(), { ip: "9.9.9.9" }, box.transports, at(i));
    await expect(startSignup(await input(), { ip: "9.9.9.9" }, box.transports, at(20))).rejects.toThrow(/Too many signup attempts/);
  });
});

describe("existing customers joining", () => {
  it("asks only for what is not verified yet (e.g. a Google sign-in with verified email needs only SMS)", async () => {
    const user = await registerUser({ name: "Bilal", email: "bilal@gmail.com", phone: undefined, password: "password123" });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: T0 } });
    const box = inbox();
    const { token } = await startSignup(await input({ userId: user.id, email: "bilal@gmail.com", passwordHash: undefined, phone: "+923214445556" }), {}, box.transports, T0);
    expect(box.sent.map((m) => m.channel)).toEqual(["sms"]);
    expect(await verifyCodes(token, { email: "", phone: box.code("sms") }, at(1000))).toMatchObject({ done: true, isNewAccount: false });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { affiliate: true } });
    expect(updated.phone).toBe("+923214445556");
    expect(updated.phoneVerifiedAt).not.toBeNull();
    expect(updated.affiliate).not.toBeNull();
  });

  it("submits straight away when email and mobile are already verified", async () => {
    const user = await registerUser({ name: "Done", email: "done@gmail.com", phone: "+923007778889", password: "password123" });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: T0, phoneVerifiedAt: T0 } });
    const box = inbox();
    const result = await startSignup(await input({ userId: user.id, email: "done@gmail.com", phone: "+923007778889", passwordHash: undefined }), {}, box.transports, T0);
    expect(result.completed).toBe(true);
    expect(box.sent).toHaveLength(0);
    expect(await prisma.affiliate.count({ where: { userId: user.id } })).toBe(1);
  });

  it("requires both codes for an unverified existing account", async () => {
    const user = await registerUser({ name: "New", email: "new@gmail.com", phone: undefined, password: "password123" });
    const box = inbox();
    await startSignup(await input({ userId: user.id, email: "new@gmail.com", passwordHash: undefined }), {}, box.transports, T0);
    expect(box.sent.map((m) => m.channel)).toEqual(["email", "sms"]);
  });
});

describe("masking", () => {
  it("hides most of the email and number", () => {
    expect(maskEmail("sana.malik@gmail.com")).toBe("s*********@gmail.com");
    expect(maskPhone("+923001234567")).toBe("+923******567");
  });
});
