import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashIp } from "@/lib/affiliate/service";
import { answerQuestion } from "@/lib/assistant/answer";
import { rateLimit } from "@/lib/rate-limit";

// The AI assistant endpoint. The Anthropic API key stays on the server; the browser only sees answers.

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

const CHAT_LIMITS = [
  { window: 60 * 1000, max: 8, label: "minute" },
  { window: 24 * 60 * 60 * 1000, max: 150, label: "day" },
] as const;

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Please type a question (up to 1,000 characters)." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `chat:${hashIp(ip)}`;
  for (const limit of CHAT_LIMITS) {
    if (!(await rateLimit(`${key}:${limit.label}`, limit.max, limit.window)).allowed) {
      return NextResponse.json(
        { error: "You're sending messages quickly. Please wait a moment, or message us on WhatsApp." },
        { status: 429 },
      );
    }
  }

  const answer = await answerQuestion(body.message, body.history);
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}
