import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { registerUser } from "@/lib/auth/service";
import { getSignupStatus, resendCode, smsVerificationEnabled, startSignup, verifyCodes, type SignupInput, type Transports } from "@/lib/affiliate/verification";
import { resetDatabase } from "../support/db";

// Affiliate signup while SMS is not set up (SMS_VERIFICATION_ENABLED not "true"): email code only.

function inbox() {
  const sent: { channel: "email" | "sms"; to: string; body: string }[] = [];
  const transports: Transports = {
    email: async (e) => (sent.push({ channel: "email", to: e.to, body: e.text }), { sent: true }),
    sms: async (s) => (sent.push({ channel: "sms", to: s.to, body: s.body }), { sent: true }),
  };
  const emailCode = () => sent.filter((m) => m.channel === "email").at(-1)?.body.match(/\b(\d{6})\b/)?.[1] ?? "";
  return { sent, transports, emailCode };
}

const T0 = new Date("2026-11-01T10:00:00Z");

async function input(overrides: Partial<SignupInput> = {}): Promise<SignupInput> {
  return {
    name: "Sana Malik",
    email: "sana@gmail.com",
    phone: "+923001112233",
    passwordHash: await hashPassword("MixPrint2026!"),
    application: { payoutMethod: "JAZZCASH", payoutAccount: "+923001112233", payoutAccountName: "Sana Malik", website: null, promotionPlan: "Instagram page" },
    ...overrides,
  };
}

const smsSetting = process.env.SMS_VERIFICATION_ENABLED;
beforeAll(() => {
  delete process.env.SMS_VERIFICATION_ENABLED;
});
afterAll(() => {
  process.env.SMS_VERIFICATION_ENABLED = smsSetting;
});
beforeEach(resetDatabase);

describe("email-only affiliate signup", () => {
  it("is the default, and SMS turns on only with SMS_VERIFICATION_ENABLED=true", () => {
    expect(smsVerificationEnabled({})).toBe(false);
    expect(smsVerificationEnabled({ SMS_VERIFICATION_ENABLED: "false" })).toBe(false);
    expect(smsVerificationEnabled({ SMS_VERIFICATION_ENABLED: "true" })).toBe(true);
    expect(smsVerificationEnabled({ SMS_VERIFICATION_ENABLED: " TRUE " })).toBe(true);
  });

  it("sends only the email code and activates after it, saving the mobile number unverified", async () => {
    const box = inbox();
    const data = await input();
    const { token, completed } = await startSignup(data, { ip: "1.1.1.1" }, box.transports, T0);
    expect(completed).toBe(false);
    expect(box.sent.map((m) => m.channel)).toEqual(["email"]);
    expect(await getSignupStatus(token, T0)).toMatchObject({ needsEmail: true, needsPhone: false });
    await expect(resendCode(token, "phone", box.transports, T0)).rejects.toThrow(/SMS/);

    const wrong = await verifyCodes(token, { email: box.emailCode() === "000000" ? "111111" : "000000", phone: "" }, T0);
    expect(wrong).toMatchObject({ done: false, email: "wrong" });
    expect(await prisma.user.count()).toBe(0);

    const done = await verifyCodes(token, { email: box.emailCode(), phone: "" }, T0);
    expect(done).toMatchObject({ done: true, isNewAccount: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: data.email }, include: { affiliate: true } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.phone).toBe(data.phone);
    expect(user.phoneVerifiedAt).toBeNull();
    expect(user.affiliate).toMatchObject({ payoutMethod: "JAZZCASH", payoutAccount: "+923001112233" });
  });

  it("lets a signed-in customer with a verified email join straight away", async () => {
    const box = inbox();
    const customer = await registerUser({ name: "Ali Raza", email: "ali@gmail.com", password: "MixPrint2026!", phone: undefined });
    await prisma.user.update({ where: { id: customer.id }, data: { emailVerifiedAt: T0 } });
    const result = await startSignup(await input({ userId: customer.id, passwordHash: undefined, email: "ali@gmail.com", phone: "+923004445566" }), {}, box.transports, T0);
    expect(result.completed).toBe(true);
    expect(box.sent).toHaveLength(0);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({ phone: "+923004445566", phoneVerifiedAt: null });
  });
});
