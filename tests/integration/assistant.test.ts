import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { answerQuestion, type MessagesClient } from "@/lib/assistant/answer";
import { ensureFreshIndex, searchKnowledge } from "@/lib/assistant/knowledge";
import { saveLevel } from "@/lib/services/admin";
import { createTestProduct, resetDatabase } from "../support/db";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** Fake client returning scripted responses and recording requests. */
function fakeClient(responses: Partial<Anthropic.Beta.BetaMessage>[]) {
  const requests: Params[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        async create(params) {
          requests.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("no scripted response left");
          return { id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", content: [], ...next } as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
  return { client, requests };
}

const text = (t: string, citations: unknown[] | null = null) => ({ type: "text", text: t, citations }) as unknown as Anthropic.Beta.BetaContentBlock;

beforeEach(async () => {
  await resetDatabase();
  const product = await createTestProduct({ slug: "glossy-business-cards" });
  await prisma.product.update({ where: { id: product.id }, data: { name: "Glossy Business Cards", summary: "Shiny premium visiting cards" } });
  const board = await saveLevel("category", null, null, { title: "Board Maker", shortDescription: "Shop signs and boards", isVisible: true, slug: undefined });
  await saveLevel("subtype", null, board, { title: "Backlit", shortDescription: "Illuminated signs that glow at night", isVisible: true, slug: undefined });
});

describe("knowledge index", () => {
  it("indexes products, services and pages, and finds them", async () => {
    expect(await ensureFreshIndex()).toBe(true);
    expect(await ensureFreshIndex()).toBe(false); // unchanged content: no rebuild

    const cards = await searchKnowledge("business card price");
    expect(cards[0]).toMatchObject({ title: "Glossy Business Cards", url: "/products/glossy-business-cards" });
    expect(cards[0].content).toMatch(/PKR 3 per unit/);

    expect((await searchKnowledge("backlit sign board"))[0]).toMatchObject({ url: "/services/board-maker#backlit" });
    expect((await searchKnowledge("affiliate commission withdrawal"))[0]).toMatchObject({ url: "/affiliate" });
    expect((await searchKnowledge("whatsapp phone number"))[0].content).toContain("+92 303 488 9255");
  });

  it("rebuilds when content changes and hides unpublished products", async () => {
    await ensureFreshIndex();
    await prisma.product.updateMany({ data: { status: "DRAFT" } });
    expect(await ensureFreshIndex()).toBe(true);
    const hits = await searchKnowledge("glossy business cards");
    expect(hits.filter((h) => h.sourceType === "PRODUCT")).toEqual([]);
  });
});

describe("answerQuestion", () => {
  it("lists matching pages when no API key is configured", async () => {
    const result = await answerQuestion("Do you make backlit boards?", [], null);
    expect(result.mode).toBe("site-search");
    expect(result.answer).toContain("[Board Maker: Backlit](/services/board-maker#backlit)");
    expect(result.sources[0].url).toBe("/services/board-maker#backlit");
  });

  it("hands off to WhatsApp when nothing matches and there is no API key", async () => {
    const result = await answerQuestion("zzzz qqqq", [], null);
    expect(result).toMatchObject({ mode: "handoff" });
    expect(result.answer).toContain("+92 303 488 9255");
  });

  it("sends site content, web search and fallbacks to Claude and returns sourced answers", async () => {
    const { client, requests } = fakeClient([
      {
        content: [
          text("Our [Glossy Business Cards](/products/glossy-business-cards) start at PKR 3 each. "),
          text("Gloss lamination resists fingerprints.", [
            { type: "web_search_result_location", url: "https://example.org/finishes", title: "Print finishes", cited_text: "…", encrypted_index: "x" },
          ]),
        ],
      },
    ]);
    const result = await answerQuestion("How much are business cards?", [{ role: "assistant", content: "Hi!" }, { role: "user", content: "Hello" }, { role: "assistant", content: "How can I help?" }], client);

    expect(result.mode).toBe("ai");
    expect(result.answer).toContain("PKR 3 each");
    expect(result.sources).toEqual([
      { title: "Glossy Business Cards", url: "/products/glossy-business-cards" },
      { title: "Print finishes", url: "https://example.org/finishes" },
    ]);

    const req = requests[0];
    expect(req).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"], output_config: { effort: "low" } });
    expect(req.tools).toEqual([expect.objectContaining({ type: "web_search_20260209", name: "web_search", max_uses: 2 })]);
    expect(JSON.stringify(req.system)).toContain("Never name, recommend or link to other printing companies");
    // Leading assistant greeting dropped; history then the question with site context
    expect(req.messages[0]).toEqual({ role: "user", content: "Hello" });
    const last = req.messages.at(-1)!;
    expect(JSON.stringify(last.content)).toContain("URL: /products/glossy-business-cards");
    expect(JSON.stringify(last.content)).toContain("Visitor question: How much are business cards?");
  });

  it("continues paused turns and hands off on refusals", async () => {
    const paused = fakeClient([{ stop_reason: "pause_turn", content: [] }, { content: [text("Done after pause.")] }]);
    expect((await answerQuestion("backlit", [], paused.client)).answer).toBe("Done after pause.");
    expect(paused.requests).toHaveLength(2);
    expect(paused.requests[1].messages.at(-1)!.role).toBe("assistant");

    const refused = fakeClient([{ stop_reason: "refusal", content: [] }]);
    expect(await answerQuestion("backlit", [], refused.client)).toMatchObject({ mode: "handoff" });
  });

  it("falls back to site search when the API errors", async () => {
    const client: MessagesClient = {
      beta: {
        messages: {
          create: async () => {
            throw new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }, "slow down", new Headers());
          },
        },
      },
    };
    expect(await answerQuestion("backlit board", [], client)).toMatchObject({ mode: "site-search" });
  });
});

describe("site-search snippets", () => {
  it("never cut words in half", async () => {
    const { answer } = await answerQuestion("business cards printing Lahore shop", [], null);
    for (const line of answer.split("\n").filter((l) => l.startsWith("- ["))) {
      expect(line).toMatch(/(\w[.!?)]?|…)$/);
      expect(line.length).toBeLessThan(260);
    }
  });
});
