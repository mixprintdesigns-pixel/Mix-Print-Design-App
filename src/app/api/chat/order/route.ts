import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE } from "@/lib/affiliate/referral-cookie";
import { hashIp } from "@/lib/affiliate/service";
import { chatOrderSchema, placeChatOrder } from "@/lib/orders/chat-order";
import { rateLimit } from "@/lib/rate-limit";

// Places an order from the AI chat. The affiliate code comes from the visitor's referral cookie.
export async function POST(request: NextRequest) {
  const parsed = chatOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the order details." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await rateLimit(`chat-order:${hashIp(ip)}`, 5, 60 * 60 * 1000)).allowed) {
    return NextResponse.json({ error: "You have placed several orders already. Please message us on WhatsApp." }, { status: 429 });
  }

  const result = await placeChatOrder(parsed.data, request.cookies.get(REFERRAL_COOKIE)?.value ?? null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ number: result.number, totalMinor: result.totalMinor }, { headers: { "Cache-Control": "no-store" } });
}
