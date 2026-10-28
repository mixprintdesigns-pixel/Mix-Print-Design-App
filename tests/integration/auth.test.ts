import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import {
  authenticate,
  createSession,
  EmailTakenError,
  LOCKOUT_MS,
  MAX_FAILED_LOGINS,
  registerUser,
  revokeSessionToken,
  validateSessionToken,
} from "@/lib/auth/service";
import { resetDatabase } from "../support/db";

const input = { name: "Bilal Ahmed", email: "bilal@example.com", phone: "+923001234567", password: "secure-pass-123" };

beforeEach(resetDatabase);

describe("registration", () => {
  it("stores an Argon2id hash, never the password", async () => {
    const user = await registerUser(input);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(input.password);
    expect(row.role).toBe("CUSTOMER");
  });

  it("rejects duplicate emails", async () => {
    await registerUser(input);
    await expect(registerUser(input)).rejects.toBeInstanceOf(EmailTakenError);
  });
});

describe("authenticate", () => {
  beforeEach(async () => {
    await registerUser(input);
  });

  it("accepts the right password", async () => {
    const result = await authenticate(input.email, input.password);
    expect(result).toMatchObject({ ok: true, user: { email: input.email } });
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    expect(await authenticate(input.email, "wrong-password-1")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("nobody@example.com", "wrong-password-1")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks the account after repeated failures, then unlocks after the lockout", async () => {
    const now = new Date();
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      expect(await authenticate(input.email, "bad", now)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await authenticate(input.email, "bad", now)).toEqual({ ok: false, reason: "locked" });
    // Even the correct password is refused while locked.
    expect(await authenticate(input.email, input.password, now)).toEqual({ ok: false, reason: "locked" });

    const later = new Date(now.getTime() + LOCKOUT_MS + 1000);
    expect(await authenticate(input.email, input.password, later)).toMatchObject({ ok: true });
  });

  it("resets the failure counter after a successful login", async () => {
    await authenticate(input.email, "bad");
    await authenticate(input.email, input.password);
    const row = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(row.failedLoginCount).toBe(0);
  });
});

describe("sessions", () => {
  it("stores only a hash of the token and validates the raw token", async () => {
    const user = await registerUser(input);
    const { token } = await createSession(user.id);
    const stored = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toBe(token);
    expect(await validateSessionToken(token)).toMatchObject({ id: user.id });
    expect(await validateSessionToken(stored.tokenHash)).toBeNull();
  });

  it("rejects and deletes expired sessions", async () => {
    const user = await registerUser(input);
    const { token } = await createSession(user.id);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("revokes sessions on logout", async () => {
    const user = await registerUser(input);
    const { token } = await createSession(user.id);
    await revokeSessionToken(token);
    expect(await validateSessionToken(token)).toBeNull();
  });
});
