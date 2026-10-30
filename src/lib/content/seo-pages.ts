import "server-only";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { seoMetadata } from "@/lib/seo";
import { CONTENT_TAG } from "./about";

// Search-engine title and description for the fixed pages, editable in Admin → SEO.
// Categories and products have their own SEO fields on their edit forms.

export const SEO_PAGES = {
  home: {
    label: "Home",
    path: "/",
    title: "Printing, Sign Boards & Design in Lahore | Mix Print Design",
    description:
      "Mix Print Design, Raiwind Road Lahore: business cards, offset and digital printing, flex and panaflex, 3D sign boards and customized gifts. Delivery across Pakistan.",
  },
  products: {
    label: "Products",
    path: "/products",
    title: "Printing Products & Prices in Lahore | Mix Print Design",
    description:
      "Browse business cards, brochures, flyers, flex printing, sign boards, stickers, packaging and customized printing with live prices or a quick quote.",
  },
  services: {
    label: "Services",
    path: "/services",
    title: "Board Maker, Offset, Digital & Customized Printing | Mix Print Design",
    description:
      "Sign boards (backlit, front-lit, 3D), offset printing, flex and digital printing, and customized mugs, shirts, awards and engraving in Lahore.",
  },
  about: {
    label: "About Us",
    path: "/about",
    title: "About Mix Print Design | Printing & Signage Studio in Lahore",
    description: "Meet Mix Print Design, a printing, signage and design studio on Raiwind Road, Lahore, serving businesses across Pakistan.",
  },
  contact: {
    label: "Contact Us",
    path: "/contact",
    title: "Contact Mix Print Design | Get a Printing Quote in Lahore",
    description: "Call or WhatsApp +92 303 488 9255, email mixprintdesigns@gmail.com or visit us on Raiwind Road, Lahore for a printing or sign board quote.",
  },
  affiliate: {
    label: "Affiliate Program",
    path: "/affiliate",
    title: "Earn with Mix Print Design | Printing Affiliate Program Pakistan",
    description: "Join the Mix Print Design affiliate program: share your link and earn commission on printing orders, paid to JazzCash, Easypaisa or bank.",
  },
} as const;

export type SeoPageKey = keyof typeof SEO_PAGES;

const entrySchema = z.object({
  title: z.string().trim().max(70, "Keep the title under 70 characters."),
  description: z.string().trim().max(170, "Keep the description under 170 characters."),
});
export const seoPagesSchema = z.record(z.string(), entrySchema);
export type SeoPagesContent = Partial<Record<SeoPageKey, z.infer<typeof entrySchema>>>;

const KEY = "seo-pages";

export async function readSeoPages(): Promise<SeoPagesContent> {
  const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
  const parsed = seoPagesSchema.safeParse(row?.value);
  return parsed.success ? (parsed.data as SeoPagesContent) : {};
}

export async function getSeoPages(): Promise<SeoPagesContent> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  return readSeoPages();
}

export async function saveSeoPages(content: SeoPagesContent): Promise<void> {
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: content }, update: { value: content } });
}

/** Page metadata (title, description, canonical, Open Graph) for a fixed page, using the admin's text when set. */
export async function pageMetadata(key: SeoPageKey): Promise<Metadata> {
  const defaults = SEO_PAGES[key];
  const saved = (await getSeoPages())[key];
  const title = saved?.title || defaults.title;
  const description = saved?.description || defaults.description;
  return seoMetadata({ title, description, path: defaults.path });
}
