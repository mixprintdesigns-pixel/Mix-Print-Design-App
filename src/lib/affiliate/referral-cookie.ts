import "server-only";
import { cookies } from "next/headers";

export const REFERRAL_COOKIE = "mp_ref";
/** Readable copy of the referral code, so WhatsApp order messages can mention it ("Ref: CODE"). */
export const REFERRAL_PUBLIC_COOKIE = "mp_ref_code";

/** The referral code remembered for this visitor (last click wins). Checkout passes it to createCommissionForOrder. */
export async function getReferralCode(): Promise<string | null> {
  return (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
}
