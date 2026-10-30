import "server-only";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";

// Original product and category images made with the OpenAI Images API.
// The key is read from the IMAGE_API_KEY environment variable (set in Vercel); it never reaches the browser.
// Generated files have "ai-" in their name, so uploads by the owner are never replaced.

export const IMAGE_VIEWS = {
  front: "Front view, straight on, the whole item clearly visible",
  angle: "Three-quarter angle view that shows thickness, edges and finish",
  "in-use": "In use in a realistic setting in Lahore, Pakistan, for example held in a hand, on a desk or on a shop front",
} as const;
export type ImageView = keyof typeof IMAGE_VIEWS;

export class ImageGenerationError extends Error {}

const STYLE =
  "Clean, premium studio product photography, plain light background, soft natural shadows, realistic materials and colours, the same consistent style for every image. " +
  'Any visible text or logo must read "Mix Print Design" or be a neutral sample design. No other brand names, logos, watermarks or website text.';

export function productImagePrompt(name: string, category: string, view: ImageView): string {
  return `Photograph of ${name} (${category}), produced by a printing and signage company. ${IMAGE_VIEWS[view]}. ${STYLE}`;
}

export function categoryImagePrompt(name: string, parent: string | null): string {
  return `Photograph showing ${name}${parent ? ` (${parent})` : ""}, made by a printing and signage company in Lahore, Pakistan. ${IMAGE_VIEWS.front}. ${STYLE}`;
}

export const isGeneratedKey = (key: string | null | undefined) => !!key && /(^|\/)ai-/.test(key);

/** Calls the Images API and returns the picture as a WebP (max 1200 px). */
export async function generateImage(prompt: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) throw new ImageGenerationError("Image generation is not set up: add IMAGE_API_KEY in Vercel → Settings → Environment Variables.");
  const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.IMAGE_MODEL ?? "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
  });
  const body = (await response.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  if (!response.ok || !body?.data?.[0]?.b64_json) {
    console.error(`Image generation failed (${response.status}): ${body?.error?.message ?? "no image returned"}`);
    throw new ImageGenerationError("The image could not be generated right now. Please try again in a minute.");
  }
  const webp = await toWebp(new Uint8Array(Buffer.from(body.data[0].b64_json, "base64")), 1200);
  if (!webp.ok) throw new ImageGenerationError(webp.error);
  await logGeneration(prompt);
  return webp.bytes;
}

/** Keeps a count of generated images so the owner can see usage (and estimate cost) in admin. */
async function logGeneration(prompt: string) {
  const key = "image-generation-log";
  const row = await prisma.siteContent.findUnique({ where: { key } });
  const log = (row?.value as { count?: number; last?: string[] } | null) ?? {};
  const value = { count: (log.count ?? 0) + 1, last: [new Date().toISOString() + " " + prompt.slice(0, 80), ...(log.last ?? [])].slice(0, 20) };
  await prisma.siteContent.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function generatedImageCount(): Promise<number> {
  const row = await prisma.siteContent.findUnique({ where: { key: "image-generation-log" } });
  return (row?.value as { count?: number } | null)?.count ?? 0;
}

/** Adds a generated image to a product, or replaces an earlier generated image. Uploaded images are never touched. */
export async function generateProductImage(productId: string, view: ImageView, replaceImageId?: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, category: { select: { name: true } }, images: { select: { id: true, storageKey: true, sortOrder: true } } },
  });
  if (!product) throw new ImageGenerationError("This product no longer exists.");
  const replacing = replaceImageId ? product.images.find((i) => i.id === replaceImageId) : undefined;
  if (replaceImageId && !isGeneratedKey(replacing?.storageKey)) {
    throw new ImageGenerationError("Only generated images can be regenerated. Your uploaded images are kept as they are.");
  }

  const bytes = await generateImage(productImagePrompt(product.name, product.category.name, view));
  const label = `${product.name} ${view === "in-use" ? "in use" : view} lahore`;
  const stored = await saveFile(descriptiveKey(`products/${productId}`, `ai-${label}`, "webp"), bytes, "image/webp");
  const alt = `${product.name} printing in Lahore – Mix Print Design`;
  if (replacing) {
    return prisma.productImage.update({ where: { id: replacing.id }, data: { url: stored.url, storageKey: stored.key } });
  }
  const sortOrder = Math.max(-1, ...product.images.map((i) => i.sortOrder)) + 1;
  return prisma.productImage.create({ data: { productId, url: stored.url, storageKey: stored.key, alt, sortOrder } });
}

/** Sets a generated category image when there is none, or replaces an earlier generated one. */
export async function generateCategoryImage(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true, imageUrl: true, imageKey: true, imageAlt: true, parent: { select: { name: true } } },
  });
  if (!category) throw new ImageGenerationError("This category no longer exists.");
  if (category.imageUrl && !isGeneratedKey(category.imageKey)) {
    throw new ImageGenerationError("This category has an image you uploaded, so it is kept. Remove it first to generate one.");
  }
  const bytes = await generateImage(categoryImagePrompt(category.name, category.parent?.name ?? null));
  const stored = await saveFile(descriptiveKey("categories", `ai-${category.name} lahore`, "webp"), bytes, "image/webp");
  await prisma.category.update({
    where: { id: categoryId },
    data: { imageUrl: stored.url, imageKey: stored.key, imageAlt: category.imageAlt || `${category.name} in Lahore – Mix Print Design` },
  });
}
