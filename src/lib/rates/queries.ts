import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CATALOG_TAG, getCategoryTree, startingUnitPrice } from "@/lib/catalog/queries";
import { ancestry, flatten, type CategoryNode } from "@/lib/catalog/tree";
import { lowestRate, preselectFor, publicSection, type PublicSection, type RateFeatureRow } from "./visibility";

export const RATES_TAG = "rates";

export type RateSettingsData = { designChargeMinor: number; minOrderMinor: number | null };
export const DEFAULT_RATE_SETTINGS: RateSettingsData = { designChargeMinor: 100_000, minOrderMinor: null };

export const variantSelect = { id: true, label: true, rateMinor: true, isVisible: true, sortOrder: true, rule: true } as const;

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
  variants: { select: variantSelect, orderBy: { sortOrder: "asc" } },
} as const;

export const sectionSelect = {
  id: true,
  title: true,
  kind: true,
  isVisible: true,
  sortOrder: true,
  fittingRateMinor: true,
  askDesignCode: true,
  showOnCategoryIds: true,
  items: { select: itemSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] as Prisma.RateItemOrderByWithRelationInput[] },
} satisfies Prisma.RateSectionSelect;

export async function readRateSettings(): Promise<RateSettingsData> {
  const row = await prisma.rateSettings.findUnique({ where: { id: "default" } });
  return row ? { designChargeMinor: row.designChargeMinor, minOrderMinor: row.minOrderMinor } : DEFAULT_RATE_SETTINGS;
}

export async function readRateFeatures(): Promise<RateFeatureRow[]> {
  return prisma.rateFeature.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, label: true, isVisible: true, sortOrder: true } });
}

// ─── Rate sections on every related page ─────────────────────────────────────
// A page shows its own rate sections, plus sections from other pages that are set to "also show" on it or on a
// page above it (e.g. the Flex section of Digital Printing shows on Flex Printing and on China Flex). There,
// the button that matches the page (China Flex → "China Flex 240 GSM") is pre-selected.

type IndexedSection = PublicSection & { pageCategoryId: string | null; showOn: string[] };
export type RateIndex = {
  pages: { categoryId: string; title: string; intro: string | null; seoTitle: string | null; seoDescription: string | null }[];
  sections: IndexedSection[];
  settings: RateSettingsData;
};

/** Every visible rate page and section, with only what customers may see. */
export async function getRateIndex(): Promise<RateIndex> {
  "use cache";
  cacheTag(RATES_TAG);
  cacheLife("hours");
  const [pages, features, settings] = await Promise.all([
    prisma.ratePage.findMany({
      where: { isVisible: true, categoryId: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { categoryId: true, title: true, intro: true, seoTitle: true, seoDescription: true, sections: { select: sectionSelect } },
    }),
    readRateFeatures(),
    readRateSettings(),
  ]);
  const sections: IndexedSection[] = [];
  for (const page of pages) {
    for (const row of [...page.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const shown = publicSection(row, features);
      if (shown) sections.push({ ...shown, pageCategoryId: page.categoryId, showOn: row.showOnCategoryIds });
    }
  }
  return {
    pages: pages.filter((p) => sections.some((s) => s.pageCategoryId === p.categoryId)).map(({ sections: _s, categoryId, ...p }) => ({ ...p, categoryId: categoryId! })),
    sections,
    settings,
  };
}

export type RateContent = {
  /** The page's own rate page (title, intro), when it has one with something to show. */
  page: RateIndex["pages"][number] | null;
  sections: PublicSection[];
  /** sectionId → the button pre-selected on this page. */
  preselect: Record<string, { groupId: string; buttonId: string }>;
  settings: RateSettingsData;
};

/**
 * The rate sections for a category page (or a product in it). `matchName` picks the pre-selected button:
 * the category's name, or the product's name on a product page.
 */
export function rateContentFor(index: RateIndex, tree: CategoryNode[], category: CategoryNode, matchName = category.name): RateContent | null {
  const chain = new Set(ancestry(tree, category).map((c) => c.id));
  const own = index.sections.filter((s) => s.pageCategoryId === category.id);
  const linked = index.sections.filter((s) => s.pageCategoryId !== category.id && s.showOn.some((id) => chain.has(id)));
  const sections = [...own, ...linked];
  if (sections.length === 0) return null;
  const preselect: RateContent["preselect"] = {};
  for (const s of matchName === category.name ? linked : sections) {
    const hit = preselectFor(s, matchName);
    if (hit) preselect[s.id] = hit;
  }
  const strip = (s: IndexedSection): PublicSection => {
    const { pageCategoryId: _p, showOn: _o, ...rest } = s;
    return rest;
  };
  return { page: index.pages.find((p) => p.categoryId === category.id) ?? null, sections: sections.map(strip), preselect, settings: index.settings };
}

/** The lowest rate on a page: the pre-selected button(s) if any, otherwise the lowest of all its sections. */
export function rateFromMinor(content: RateContent): number {
  const picked = Object.entries(content.preselect).map(([sid, p]) =>
    content.sections.find((s) => s.id === sid)?.groups.find((g) => g.id === p.groupId)?.buttons.find((b) => b.id === p.buttonId)?.rateMinor,
  );
  const rates = picked.filter((r): r is number => typeof r === "number");
  return rates.length ? Math.min(...rates) : lowestRate(content.sections);
}

/** A price for every category card: "From Rs 45 per sq ft" (rate sections) or "From PKR 2.50 / unit" (its products). */
export type PriceHint = { kind: "sqft" | "unit"; fromMinor: number };

export async function getPriceHints(): Promise<Record<string, PriceHint>> {
  "use cache";
  cacheTag(RATES_TAG, CATALOG_TAG);
  cacheLife("hours");
  const [index, tree] = await Promise.all([getRateIndex(), getCategoryTree()]);
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    select: { categoryId: true, basePriceMinor: true, priceTiers: { select: { minQuantity: true, unitPriceMinor: true } } },
  });
  const cheapest = new Map<string, number>();
  for (const p of products) {
    const price = startingUnitPrice(p);
    cheapest.set(p.categoryId, Math.min(cheapest.get(p.categoryId) ?? Infinity, price));
  }
  const hints: Record<string, PriceHint> = {};
  const subtreeMin = (node: CategoryNode): number => Math.min(cheapest.get(node.id) ?? Infinity, ...node.children.map(subtreeMin));
  for (const node of flatten(tree)) {
    const content = rateContentFor(index, tree, node);
    if (content) hints[node.id] = { kind: "sqft", fromMinor: rateFromMinor(content) };
    else {
      const min = subtreeMin(node);
      if (Number.isFinite(min)) hints[node.id] = { kind: "unit", fromMinor: min };
    }
  }
  return hints;
}

/** Rate content for a category page, read from the cached index. */
export async function getRateContent(category: CategoryNode, tree: CategoryNode[], matchName?: string): Promise<RateContent | null> {
  return rateContentFor(await getRateIndex(), tree, category, matchName);
}
