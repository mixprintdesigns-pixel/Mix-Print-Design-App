// What the website shows from the rate data: hidden items and variants, and anything with a rate of 0, are left out.

export type RateVariantType = "NONE" | "GSM" | "SERIES";

export type RateVariantRow = { id: string; label: string; rateMinor: number; isVisible: boolean; sortOrder: number };
export type RateItemRow = {
  id: string;
  section: string | null;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  rateMinor: number;
  variantType: RateVariantType;
  isVisible: boolean;
  sortOrder: number;
  variants: RateVariantRow[];
};

export type PublicRateVariant = { id: string; label: string; rateMinor: number };
export type PublicRateItem = Omit<RateItemRow, "isVisible" | "sortOrder" | "variants"> & { variants: PublicRateVariant[] };

/** The variants a customer can choose: visible, with a rate set. */
export function publicVariants(variants: RateVariantRow[]): PublicRateVariant[] {
  return variants
    .filter((v) => v.isVisible && v.rateMinor > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, label, rateMinor }) => ({ id, label, rateMinor }));
}

/** The item as the website shows it, or null when it is hidden or has no rate. */
export function publicItem(item: RateItemRow): PublicRateItem | null {
  if (!item.isVisible) return null;
  const { isVisible: _v, sortOrder: _s, variants, ...rest } = item;
  if (item.variantType === "NONE") return item.rateMinor > 0 ? { ...rest, variants: [] } : null;
  const shown = publicVariants(variants);
  return shown.length > 0 ? { ...rest, variants: shown } : null;
}

export function publicItems(items: RateItemRow[]): PublicRateItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder).map(publicItem).filter((i): i is PublicRateItem => i !== null);
}

/** The lowest rate per sq ft an item can be ordered at (for "from" prices and structured data). */
export function lowestRate(item: PublicRateItem): number {
  return item.variants.length > 0 ? Math.min(...item.variants.map((v) => v.rateMinor)) : item.rateMinor;
}

/** The rate for the chosen variant (or the item's own rate when it has no variants); null if not available. */
export function rateFor(item: PublicRateItem, variantId: string | null | undefined): { rateMinor: number; variant: PublicRateVariant | null } | null {
  if (item.variantType === "NONE") return item.rateMinor > 0 ? { rateMinor: item.rateMinor, variant: null } : null;
  const variant = item.variants.find((v) => v.id === variantId);
  return variant ? { rateMinor: variant.rateMinor, variant } : null;
}

export const VARIANT_LABEL: Record<RateVariantType, string> = { NONE: "", GSM: "GSM", SERIES: "Series" };

/** Items grouped by their section, in the order the sections first appear (no section = a group named ""). */
export function groupBySection<T extends { section: string | null }>(items: T[]): { section: string; items: T[] }[] {
  const groups: { section: string; items: T[] }[] = [];
  for (const item of items) {
    const section = item.section?.trim() ?? "";
    const group = groups.find((g) => g.section === section);
    if (group) group.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}
