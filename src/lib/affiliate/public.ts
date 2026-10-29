import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getAffiliateSettings } from "./service";

export const AFFILIATE_SETTINGS_TAG = "affiliate-settings";

/** Program terms shown on public pages (home, /affiliate). Cached; refreshed when an admin saves settings. */
export async function getPublicProgramTerms() {
  "use cache";
  cacheTag(AFFILIATE_SETTINGS_TAG);
  cacheLife("hours");
  const s = await getAffiliateSettings();
  return { defaultRateBps: s.defaultRateBps, cookieDays: s.cookieDays, minWithdrawalMinor: s.minWithdrawalMinor, holdDays: s.holdDays };
}
