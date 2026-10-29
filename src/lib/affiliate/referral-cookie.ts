import "server-only";
import { cookies } from "next/headers";

export const REFERRAL_COOKIE = "mp_ref";

/** The referral code remembered for this visitor (last click wins). Checkout passes it to createCommissionForOrder. */
export async function getReferralCode(): Promise<string | null> {
  return (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
}
