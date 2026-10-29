import "server-only";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/crypto";
import type { RegisterInput } from "@/lib/validation";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
};

export class EmailTakenError extends Error {}

/**
 * Emails in ADMIN_EMAILS (comma separated) become administrators when they register, but only
 * while the store has no administrator yet. Emails are not verified at this stage, so this is a
 * one-time bootstrap for the owner's first account, not an ongoing way to grant access.
 */
export function isBootstrapAdmin(email: string, env = process.env.ADMIN_EMAILS): boolean {
  return (env ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const passwordHash = await hashPassword(input.password);
  const role =
    isBootstrapAdmin(input.email) && (await prisma.user.count({ where: { role: "ADMIN" } })) === 0
      ? "ADMIN"
      : "CUSTOMER";
  try {
    return await prisma.user.create({
      data: { name: input.name, email: input.email, phone: input.phone, passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") throw new EmailTakenError();
    throw error;
  }
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "locked" };

/**
 * Checks credentials with a per-account lockout after repeated failures.
 * Always runs one Argon2 verification so timing does not reveal unknown emails.
 */
export async function authenticate(email: string, password: string, now = new Date()): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(await getDummyHash(), password);
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    await verifyPassword(await getDummyHash(), password);
    return { ok: false, reason: "locked" };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCKOUT_MS) : null,
      },
    });
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300),
      ipAddress: meta.ipAddress?.slice(0, 64),
    },
  });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function revokeSessionToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
