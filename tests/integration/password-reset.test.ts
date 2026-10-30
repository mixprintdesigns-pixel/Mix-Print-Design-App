import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, createSession, registerUser, validateSessionToken } from "@/lib/auth/service";
import { requestPasswordReset, resetPassword, RESET_MAX_ATTEMPTS } from "@/lib/auth/password-reset";
import type { Email, EmailTransport } from "@/lib/email";
import { resetDatabase } from "../support/db";

const input = { name: "Bilal Ahmed", email: "bilal@example.com", phone: "+923001234567", password: "old-pass-12345" };
const NEW_PASSWORD = "new-pass-67890";

let sent: Email[] = [];
const transport: EmailTransport = async (e) => (sent.push(e), { sent: true });
const codeFromEmail = () => /code is: (\d{6})/.exec(sent.at(-1)!.text)![1];
const originalAdmins = process.env.ADMIN_EMAILS;

beforeEach(async () => {
  await resetDatabase();
  sent = [];
  delete process.env.ADMIN_EMAILS;
});
afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdmins;
});

describe("forgot password", () => {
  it("emails a code, sets the new password and signs out other devices", async () => {
    const user = await registerUser(input);
    const { token } = await createSession(user.id);

    await requestPasswordReset(input.email, {}, transport);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(input.email);

    const result = await resetPassword(input.email, codeFromEmail(), NEW_PASSWORD);
    expect(result).toMatchObject({ ok: true, role: "CUSTOMER" });
    expect((await authenticate(input.email, NEW_PASSWORD)).ok).toBe(true);
    expect((await authenticate(input.email, input.password)).ok).toBe(false);
    expect(await validateSessionToken(token)).toBeNull();
    // The code works only once.
    expect((await resetPassword(input.email, codeFromEmail(), "another-pass-1")).ok).toBe(false);
  });

  it("does not email unknown addresses or create accounts for them", async () => {
    await requestPasswordReset("nobody@example.com", {}, transport);
    expect(sent).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("blocks the code after too many wrong tries", async () => {
    await registerUser(input);
    await requestPasswordReset(input.email, {}, transport);
    const code = codeFromEmail();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) expect((await resetPassword(input.email, wrong, NEW_PASSWORD)).ok).toBe(false);
    expect((await resetPassword(input.email, code, NEW_PASSWORD)).ok).toBe(false);
  });

  it("makes an ADMIN_EMAILS address an admin, keeping the existing account and its data", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    const owner = await registerUser({ ...input, email: "owner@example.com" });
    await prisma.user.update({ where: { id: owner.id }, data: { role: "CUSTOMER" } });
    await requestPasswordReset("owner@example.com", {}, transport);
    const result = await resetPassword("owner@example.com", codeFromEmail(), NEW_PASSWORD);
    expect(result).toMatchObject({ ok: true, userId: owner.id, role: "ADMIN" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("creates the admin account for an ADMIN_EMAILS address that has none", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    await requestPasswordReset("owner@example.com", {}, transport);
    const result = await resetPassword("owner@example.com", codeFromEmail(), NEW_PASSWORD);
    expect(result).toMatchObject({ ok: true, role: "ADMIN" });
    expect((await authenticate("owner@example.com", NEW_PASSWORD)).ok).toBe(true);
  });
});
