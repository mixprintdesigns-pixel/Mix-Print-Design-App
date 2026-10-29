import "server-only";
import { cookies } from "next/headers";

// Ties a pending affiliate signup to this browser. Server Actions only for set/clear.
export const AFFILIATE_SIGNUP_COOKIE = "mp_aff_signup";

export async function setSignupCookie(token: string) {
  (await cookies()).set(AFFILIATE_SIGNUP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/affiliate",
    maxAge: 24 * 60 * 60,
  });
}

export async function getSignupCookie(): Promise<string | null> {
  return (await cookies()).get(AFFILIATE_SIGNUP_COOKIE)?.value ?? null;
}

export async function clearSignupCookie() {
  (await cookies()).delete({ name: AFFILIATE_SIGNUP_COOKIE, path: "/affiliate" });
}
