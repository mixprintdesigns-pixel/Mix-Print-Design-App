import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { generatedImageCount, generateImage, generateProductImage, ImageGenerationError, productImagePrompt } from "@/lib/images/generate";
import { createTestProduct, resetDatabase } from "../support/db";

beforeEach(resetDatabase);
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.IMAGE_API_KEY;
});

async function fakeOpenAi() {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#00afef" } }).png().toBuffer();
  const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
    return new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), { status: 200 });
  });
  return calls;
}

describe("AI images", () => {
  it("needs IMAGE_API_KEY and never sends it anywhere but OpenAI", async () => {
    await expect(generateImage("x")).rejects.toBeInstanceOf(ImageGenerationError);
    process.env.IMAGE_API_KEY = "sk-test";
    const calls = await fakeOpenAi();
    const webp = await generateImage("A mug");
    expect((await sharp(webp).metadata()).format).toBe("webp");
    expect(calls[0]).toMatchObject({ url: "https://api.openai.com/v1/images/generations", auth: "Bearer sk-test" });
    expect(await generatedImageCount()).toBe(1);
  });

  it("adds generated product images and only regenerates generated ones", async () => {
    process.env.IMAGE_API_KEY = "sk-test";
    await fakeOpenAi();
    const product = await createTestProduct();
    const uploaded = await prisma.productImage.create({ data: { productId: product.id, url: "/x.webp", storageKey: "products/p/photo.webp", alt: "Photo" } });

    const generated = await generateProductImage(product.id, "angle");
    expect(generated.storageKey).toMatch(new RegExp(`^products/${product.id}/ai-.*-angle-lahore-[0-9a-f]{6}\\.webp$`));
    expect(generated.alt).toContain("printing in Lahore – Mix Print Design");

    const again = await generateProductImage(product.id, "angle", generated.id);
    expect(again.id).toBe(generated.id);
    expect(again.storageKey).not.toBe(generated.storageKey);
    await expect(generateProductImage(product.id, "front", uploaded.id)).rejects.toThrow(/uploaded images are kept/);
    expect(await prisma.productImage.findUniqueOrThrow({ where: { id: uploaded.id } })).toMatchObject({ url: "/x.webp" });
  });

  it("asks for an original, unbranded studio image", () => {
    const prompt = productImagePrompt("Matte Business Cards", "Business Cards", "in-use");
    expect(prompt).toContain("Matte Business Cards");
    expect(prompt).toContain("Mix Print Design");
    expect(prompt).toContain("No other brand names, logos, watermarks");
  });
});
