import "server-only";
import type { ProductInput } from "./product-input";
import { paisaToRupeesInput } from "./product-input";
import type { AdminProduct } from "./catalog-service";
import { listAdminCategories } from "./catalog-service";

export const EMPTY_PRODUCT: ProductInput = {
  sku: "",
  name: "",
  slug: "",
  categoryId: "",
  summary: "",
  description: "",
  basePrice: "",
  minQuantity: 1,
  quantityStep: 1,
  turnaroundDays: 3,
  status: "DRAFT",
  isAvailable: true,
  isFeatured: false,
  allowsDesignService: true,
  seoTitle: "",
  seoDescription: "",
  affiliateCommission: "",
  priceTiers: [],
  bulkDiscounts: [],
  options: [],
};

/** Converts a stored product into the editor's input format (rupees and percentages as text). */
export function toProductInput(p: AdminProduct): ProductInput {
  return {
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    summary: p.summary ?? "",
    description: p.description,
    basePrice: paisaToRupeesInput(p.basePriceMinor),
    minQuantity: p.minQuantity,
    quantityStep: p.quantityStep,
    turnaroundDays: p.turnaroundDays,
    status: p.status,
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    allowsDesignService: p.allowsDesignService,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    affiliateCommission: p.affiliateCommissionBps === null ? "" : String(p.affiliateCommissionBps / 100),
    priceTiers: p.priceTiers.map((t) => ({ minQuantity: t.minQuantity, unitPrice: paisaToRupeesInput(t.unitPriceMinor) })),
    bulkDiscounts: p.bulkDiscounts.map((d) => ({ minQuantity: d.minQuantity, percent: String(d.percentBps / 100) })),
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      values: o.values.map((v) => ({
        id: v.id,
        label: v.label,
        priceDelta: paisaToRupeesInput(v.priceDeltaMinor),
        pricing: v.pricing,
      })),
    })),
  };
}

/** Categories in tree order with their depth, for indented <select> menus. */
export async function categoryChoices() {
  const all = await listAdminCategories();
  const byParent = new Map<string | null, typeof all>();
  for (const c of all) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const out: ((typeof all)[number] & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
