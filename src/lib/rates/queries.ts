import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { publicItems, type PublicRateItem } from "./visibility";

export const RATES_TAG = "rates";

export type RateSettingsData = { designChargeMinor: number; minOrderMinor: number | null; gsmOptions: number[]; seriesOptions: string[] };
export const DEFAULT_RATE_SETTINGS: RateSettingsData = {
  designChargeMinor: 100_000,
  minOrderMinor: null,
  gsmOptions: [200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400],
  seriesOptions: ["1000 series", "2000 series", "3000 series"],
};

export const itemSelect = {
  id: true,
  section: true,
  name: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  imageAlt: true,
  rateMinor: true,
  variantType: true,
  isVisible: true,
  sortOrder: true,
  variants: { select: { id: true, label: true, rateMinor: true, isVisible: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
} as const;

export async function readRateSettings(): Promise<RateSettingsData> {
  const row = await prisma.rateSettings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_RATE_SETTINGS;
  return { designChargeMinor: row.designChargeMinor, minOrderMinor: row.minOrderMinor, gsmOptions: row.gsmOptions, seriesOptions: row.seriesOptions };
}

export type PublicRatePage = {
  id: string;
  title: string;
  intro: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  items: PublicRateItem[];
  settings: Pick<RateSettingsData, "designChargeMinor" | "minOrderMinor">;
};

/** The rate page shown on a service page, with only what customers may see; null when there is nothing to show. */
export async function getPublicRatePage(categoryId: string): Promise<PublicRatePage | null> {
  "use cache";
  cacheTag(RATES_TAG);
  cacheLife("hours");
  const page = await prisma.ratePage.findUnique({
    where: { categoryId },
    select: { id: true, title: true, intro: true, seoTitle: true, seoDescription: true, isVisible: true, items: { select: itemSelect } },
  });
  if (!page || !page.isVisible) return null;
  const items = publicItems(page.items);
  if (items.length === 0) return null;
  const settings = await readRateSettings();
  const { isVisible: _v, items: _i, ...rest } = page;
  return { ...rest, items, settings: { designChargeMinor: settings.designChargeMinor, minOrderMinor: settings.minOrderMinor } };
}
