import { NextResponse, type NextRequest } from "next/server";
import { safeLandingPath } from "@/lib/affiliate/commission";
import { REFERRAL_COOKIE, REFERRAL_PUBLIC_COOKIE } from "@/lib/affiliate/referral-cookie";
import { getAffiliateSettings, recordClick } from "@/lib/affiliate/service";

// Referral links: /r/CODE or /r/CODE?to=/products/business-cards
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const to = safeLandingPath(request.nextUrl.searchParams.get("to"));
  const response = NextResponse.redirect(new URL(to, request.url), 307);

  const affiliate = await recordClick(code, {
    landingPath: to,
    referrer: request.headers.get("referer"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  if (affiliate) {
    const { cookieDays } = await getAffiliateSettings();
    response.cookies.set(REFERRAL_COOKIE, affiliate.code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieDays * 24 * 60 * 60,
    });
    // Not secret: lets WhatsApp order messages include the code for staff to record the order.
    response.cookies.set(REFERRAL_PUBLIC_COOKIE, affiliate.code, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieDays * 24 * 60 * 60,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
