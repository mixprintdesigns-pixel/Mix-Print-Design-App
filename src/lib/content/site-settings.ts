import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { BUSINESS, MAP_EMBED_URL } from "@/lib/business";
import { prisma } from "@/lib/db";
import { CONTENT_TAG } from "./about";

// Contact details, social links, map and tagline shown across the site. Editable in Admin → Contact & social.

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Links must start with https://");

export const siteSettingsSchema = z.object({
  tagline: z.string().trim().min(5, "Write a short tagline.").max(120),
  address: z.string().trim().min(5).max(200),
  phoneDisplay: z.string().trim().min(7).max(30),
  whatsappNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^92\d{10}$/.test(v), "WhatsApp number: use the international format, e.g. 923034889255."),
  email: z.string().trim().email("Enter a valid email address."),
  facebookUrl: url,
  instagramUrl: url,
  tiktokUrl: url,
  youtubeUrl: url,
  mapEmbedUrl: url.refine((v) => v === "" || /^https:\/\/(www\.)?google\.[a-z.]+\/maps/.test(v), "Use a Google Maps link."),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  tagline: "Print that makes your brand stand out.",
  address: BUSINESS.address,
  phoneDisplay: BUSINESS.phoneDisplay,
  whatsappNumber: BUSINESS.whatsappNumber,
  email: BUSINESS.email,
  facebookUrl: BUSINESS.facebookUrl,
  instagramUrl: "",
  tiktokUrl: "",
  youtubeUrl: "",
  mapEmbedUrl: MAP_EMBED_URL,
};

const KEY = "site-settings";

/** Uncached read (saved values merged over the defaults). */
export async function readSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
  const parsed = siteSettingsSchema.partial().safeParse(row?.value ?? {});
  return { ...DEFAULT_SITE_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  return readSiteSettings();
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: settings }, update: { value: settings } });
}

/** WhatsApp click-to-chat link for the configured number. */
export function whatsappUrl(settings: Pick<SiteSettings, "whatsappNumber">, message?: string): string {
  const base = `https://wa.me/${settings.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
