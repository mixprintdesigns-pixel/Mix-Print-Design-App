import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BUSINESS, whatsappLink } from "@/lib/business";
import { ensureFreshIndex, searchKnowledge, type SearchHit } from "./knowledge";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type Source = { title: string; url: string };
export type ChatAnswer = { answer: string; sources: Source[]; mode: "ai" | "site-search" | "handoff" };

/** The subset of the Anthropic client this module uses, so tests can pass a fake. */
export type MessagesClient = {
  beta: { messages: { create(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage> } };
};

const MODEL = process.env.CHAT_MODEL ?? "claude-opus-5-5";
const MAX_PAUSE_CONTINUATIONS = 3;

const HANDOFF = `I'm not sure about that one. Please message us on WhatsApp at ${BUSINESS.phoneDisplay} (${whatsappLink()}) or use the [contact form](/contact), and our team will help you.`;

// Stable across requests so it can be cached; per-request material goes in the user turn.
const SYSTEM_PROMPT = `You are the website assistant for ${BUSINESS.name}, a printing, signage and design business on ${BUSINESS.address}.
You help visitors with Mix Print Design's products, prices, services (sign boards, offset and digital printing), ordering, design help and the affiliate program.

How to answer:
- Use the SITE CONTENT provided with each question as your main source. Prices, products, services and policies must come from it; never invent a price, product, discount or delivery promise.
- Link to the relevant pages with Markdown links using the exact relative URLs from the site content, e.g. [Matte business cards](/services/offset-printing/business-cards/matte).
- If the site content does not answer the question, you may use web search for general printing knowledge (materials, sizes, file formats, finishes). Present it as general information, and bring the answer back to how Mix Print Design can help.
- Stay on Mix Print Design topics. Never name, recommend or link to other printing companies, sign makers or online print shops, even if search results mention them. Politely decline unrelated requests.
- If you cannot answer confidently, say so and suggest WhatsApp (${BUSINESS.phoneDisplay}) or the contact page (/contact). For custom sizes, sign boards and bulk jobs, suggest a quote.
- Be warm, clear and brief: usually 2–5 short sentences or a short list. Reply in the visitor's language (English, Urdu or Roman Urdu).`;

function formatContext(hits: SearchHit[]): string {
  if (hits.length === 0) return "SITE CONTENT: (no matching pages found)";
  return ["SITE CONTENT (from mixprint website):", ...hits.map((h, i) => `[${i + 1}] ${h.title} — URL: ${h.url}\n${h.content.slice(0, 1500)}`)].join("\n\n");
}

/** First line of a chunk, shortened at a word boundary. */
function snippet(content: string, max = 140): string {
  const line = content.split("\n")[0].replace(/^(Product|Service): /, "");
  if (line.length <= max) return line;
  return `${line.slice(0, line.lastIndexOf(" ", max)).replace(/[,.;:]$/, "")}…`;
}

/** Answer without the language model: point the visitor to the best matching pages. */
function siteSearchAnswer(hits: SearchHit[]): ChatAnswer {
  if (hits.length === 0) return { answer: HANDOFF, sources: [], mode: "handoff" };
  const top = hits.slice(0, 4);
  return {
    answer: [
      "Here's what I found on our website:",
      ...top.map((h) => `- [${h.title}](${h.url}): ${snippet(h.content)}`),
      `\nFor prices on custom jobs, message us on WhatsApp at ${BUSINESS.phoneDisplay}.`,
    ].join("\n"),
    sources: top.map(({ title, url }) => ({ title, url })),
    mode: "site-search",
  };
}

let defaultClient: MessagesClient | null = null;
function getClient(): MessagesClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  defaultClient ??= new Anthropic();
  return defaultClient;
}

/**
 * Answers a visitor question grounded in the site's own content, with Claude's web search as a fallback.
 * Without an API key it falls back to listing the best matching pages.
 */
export async function answerQuestion(
  question: string,
  history: ChatTurn[] = [],
  client: MessagesClient | null = getClient(),
): Promise<ChatAnswer> {
  await ensureFreshIndex();
  const hits = await searchKnowledge(question);
  if (!client) return siteSearchAnswer(hits);

  // The conversation must start with a user turn, so drop any leading assistant messages.
  const recent = history.slice(-8);
  const firstUser = recent.findIndex((t) => t.role === "user");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(firstUser < 0 ? [] : recent.slice(firstUser)).map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: [
        { type: "text", text: formatContext(hits) },
        { type: "text", text: `Visitor question: ${question}` },
      ],
    },
  ];

  try {
    let response: Anthropic.Beta.BetaMessage | undefined;
    for (let attempt = 0; attempt <= MAX_PAUSE_CONTINUATIONS; attempt++) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000, // short chat answers by design
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // a safety decline is retried on Anthropic's recommended fallback model
        output_config: { effort: "low" }, // chat: fast, concise answers
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: 2,
            user_location: { type: "approximate", city: "Lahore", country: "PK", timezone: "Asia/Karachi" },
          },
        ],
        messages,
      });
      // A long server-side search can pause the turn; send it back so the server continues.
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (!response || response.stop_reason === "refusal" || response.stop_reason === "pause_turn") {
      return { answer: HANDOFF, sources: [], mode: "handoff" };
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return { answer: HANDOFF, sources: [], mode: "handoff" };

    return { answer: text, sources: collectSources(response, hits, text), mode: "ai" };
  } catch (error) {
    // Typed SDK errors (rate limits, outages): degrade to site search rather than failing the chat.
    if (error instanceof Anthropic.APIError) {
      console.error(`Chat assistant API error ${error.status}: ${error.message}`);
      return siteSearchAnswer(hits);
    }
    throw error;
  }
}

/** Site pages the answer links to, plus web pages it cited from search. */
function collectSources(response: Anthropic.Beta.BetaMessage, hits: SearchHit[], text: string): Source[] {
  const sources = new Map<string, Source>();
  for (const hit of hits) if (text.includes(`](${hit.url})`)) sources.set(hit.url, { title: hit.title, url: hit.url });
  for (const block of response.content) {
    if (block.type !== "text") continue;
    for (const citation of block.citations ?? []) {
      if (citation.type === "web_search_result_location" && citation.url) {
        sources.set(citation.url, { title: citation.title ?? citation.url, url: citation.url });
      }
    }
  }
  return [...sources.values()].slice(0, 6);
}
