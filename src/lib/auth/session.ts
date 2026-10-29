import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, revokeSessionToken, validateSessionToken, type SessionUser } from "./service";

export const SESSION_COOKIE = "mp_session";

/** Current signed-in user, or null. Deduplicated per request. Must be called inside <Suspense>. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** For pages and actions that require login. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}

export type StaffRole = "STAFF" | "ADMIN";

/** For admin pages and actions. Customers and visitors are redirected or rejected. */
export async function requireStaff(roles: StaffRole[] = ["STAFF", "ADMIN"]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (!(roles as string[]).includes(user.role)) redirect("/");
  return user;
}

/** Server Actions only: starts a session and sets the httpOnly cookie. */
export async function startSession(userId: string): Promise<void> {
  const h = await headers();
  const { token, expiresAt } = await createSession(userId, {
    userAgent: h.get("user-agent"),
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Server Actions only. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  jar.delete(SESSION_COOKIE);
}

/** Only allow same-site relative redirects after login, to prevent open redirects. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/account";
  }
  return next;
}
