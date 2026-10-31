"use server";

import { headers } from "next/headers";
import { getReferralCode } from "@/lib/affiliate/referral-cookie";
import { hashIp } from "@/lib/affiliate/service";
import { getCurrentUser } from "@/lib/auth/session";
import { placeWebsiteOrder, websiteOrderSchema, type WebsiteOrderResult } from "@/lib/orders/website-order";
import { rateLimit } from "@/lib/rate-limit";

/** "Order now" on a product page: saves the order (with the affiliate from the referral cookie) before WhatsApp opens. */
export async function placeWebsiteOrderAction(input: unknown): Promise<WebsiteOrderResult> {
  const parsed = websiteOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await rateLimit(`website-order:${hashIp(ip)}`, 10, 60 * 60 * 1000)).allowed) {
    return { ok: false, error: "You have placed several orders already. Please message us on WhatsApp." };
  }
  const user = await getCurrentUser();
  return placeWebsiteOrder(parsed.data, { referralCode: await getReferralCode(), userId: user?.id ?? null });
}
