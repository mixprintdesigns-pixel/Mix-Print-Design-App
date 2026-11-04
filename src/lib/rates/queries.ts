import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { publicSections, type PublicSection, type RateFeatureRow } from "./visibility";

export const RATES_TAG = "rates";

export type RateSettingsData = { designChargeMinor: number; minOrderMinor: number | null };
export const DEFAULT_RATE_SETTINGS: RateSettingsData = { designChargeMinor: 100_000, minOrderMinor: null };

export const itemSelect = {
  id: true,
  name: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  imageAlt: true,
  rateMinor: true,
  isVisible: true,
  sortOrder: true,
  featureIds: true,
  variants: { select: { id: true, label: true, rateMinor: true, isVisible: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
} as const;

export const sectionSelect = {
  id: true,
  title: true,
  kind: true,
  isVisible: true,
  sortOrder: true,
  items: { select: itemSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] as Prisma.RateItemOrderByWithRelationInput[] },
} satisfies Prisma.RateSectionSelect;

export async function readRateSettings(): Promise<RateSettingsData> {
  const row = await prisma.rateSettings.findUnique({ where: { id: "default" } });
  return row ? { designChargeMinor: row.designChargeMinor, minOrderMinor: row.minOrderMinor } : DEFAULT_RATE_SETTINGS;
}

export async function readRateFeatures(): Promise<RateFeatureRow[]> {
  return prisma.rateFeature.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, label: true, isVisible: true, sortOrder: true } });
}

export type PublicRatePage = {
  id: string;
  title: string;
  intro: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sections: PublicSection[];
  settings: RateSettingsData;
};

/** The rate sections shown on a service page, with only what customers may see; null when there is nothing to show. */
export async function getPublicRatePage(categoryId: string): Promise<PublicRatePage | null> {
  "use cache";
  cacheTag(RATES_TAG);
  cacheLife("hours");
  const page = await prisma.ratePage.findUnique({
    where: { categoryId },
    select: { id: true, title: true, intro: true, seoTitle: true, seoDescription: true, isVisible: true, sections: { select: sectionSelect } },
  });
  if (!page || !page.isVisible) return null;
  const [features, settings] = await Promise.all([readRateFeatures(), readRateSettings()]);
  const sections = publicSections(page.sections, features);
  if (sections.length === 0) return null;
  const { isVisible: _v, sections: _s, ...rest } = page;
  return { ...rest, sections, settings };
}
