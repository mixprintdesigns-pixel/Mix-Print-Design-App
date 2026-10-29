// Pure pricing and configuration rules, shared by the server and the product page.
// Keep this file free of database and Next.js imports so it can run anywhere.

export const MAX_QUANTITY = 100_000;

export type PriceTierInput = { minQuantity: number; unitPriceMinor: number };
export type BulkDiscountInput = { minQuantity: number; percentBps: number };
export type OptionPricingMode = "PER_UNIT" | "PER_ORDER";

export type OptionInput = {
  id: string;
  name: string;
  values: { id: string; label: string; priceDeltaMinor: number; pricing?: OptionPricingMode }[];
};

export type ProductPricingInput = {
  basePriceMinor: number;
  minQuantity: number;
  quantityStep: number;
  priceTiers: PriceTierInput[];
  bulkDiscounts?: BulkDiscountInput[];
  options: OptionInput[];
};

export type SelectedOption = {
  optionId: string;
  option: string;
  valueId: string;
  value: string;
  priceDeltaMinor: number;
  pricing: OptionPricingMode;
};

export type LinePrice = {
  /** Tier price plus per-unit option surcharges. */
  unitPriceMinor: number;
  /** One-off charges for the line (setup, plates, die cutting). */
  flatFeesMinor: number;
  discountBps: number;
  discountMinor: number;
  lineTotalMinor: number;
};

/** Highest tier at or below the quantity, by minQuantity. */
function matchTier<T extends { minQuantity: number }>(tiers: T[], quantity: number): T | undefined {
  let best: T | undefined;
  for (const tier of tiers) {
    if (tier.minQuantity <= quantity && (!best || tier.minQuantity > best.minQuantity)) best = tier;
  }
  return best;
}

/** Unit price before options: the highest tier at or below the quantity, else the base price. */
export function tierUnitPrice(basePriceMinor: number, tiers: PriceTierInput[], quantity: number): number {
  return matchTier(tiers, quantity)?.unitPriceMinor ?? basePriceMinor;
}

export function bulkDiscountBps(discounts: BulkDiscountInput[] | undefined, quantity: number): number {
  return matchTier(discounts ?? [], quantity)?.percentBps ?? 0;
}

export function validateQuantity(
  product: Pick<ProductPricingInput, "minQuantity" | "quantityStep">,
  quantity: number,
): string | null {
  if (!Number.isInteger(quantity)) return "Quantity must be a whole number.";
  if (quantity < product.minQuantity) return `Minimum order quantity is ${product.minQuantity}.`;
  if (quantity > MAX_QUANTITY)
    return `For orders above ${MAX_QUANTITY.toLocaleString()} please request a custom quote.`;
  if ((quantity - product.minQuantity) % product.quantityStep !== 0)
    return `Quantity must increase in steps of ${product.quantityStep}.`;
  return null;
}

/**
 * Checks that exactly one value is chosen for every option and nothing else.
 * Returns the selection in option order, or an error message.
 */
export function resolveSelection(
  options: OptionInput[],
  optionValueIds: string[],
): { ok: true; selection: SelectedOption[] } | { ok: false; error: string } {
  const chosen = new Set(optionValueIds);
  if (chosen.size !== optionValueIds.length) return { ok: false, error: "Duplicate option selected." };

  const selection: SelectedOption[] = [];
  for (const option of options) {
    const matches = option.values.filter((v) => chosen.has(v.id));
    if (matches.length !== 1) return { ok: false, error: `Please choose one ${option.name}.` };
    const value = matches[0];
    chosen.delete(value.id);
    selection.push({
      optionId: option.id,
      option: option.name,
      valueId: value.id,
      value: value.label,
      priceDeltaMinor: value.priceDeltaMinor,
      pricing: value.pricing ?? "PER_UNIT",
    });
  }
  if (chosen.size > 0) return { ok: false, error: "Unknown option selected." };
  return { ok: true, selection };
}

/** Stable key so identical configurations of a product merge into one cart line. */
export function configKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join("|");
}

/**
 * Line price = (tier unit price + per-unit options) × quantity − bulk discount + per-order fees.
 * Bulk discounts apply to the printed units only, not to one-off fees.
 */
export function linePrice(
  product: Pick<ProductPricingInput, "basePriceMinor" | "priceTiers" | "bulkDiscounts">,
  selection: SelectedOption[],
  quantity: number,
): LinePrice {
  let unitPriceMinor = tierUnitPrice(product.basePriceMinor, product.priceTiers, quantity);
  let flatFeesMinor = 0;
  for (const s of selection) {
    if (s.pricing === "PER_ORDER") flatFeesMinor += s.priceDeltaMinor;
    else unitPriceMinor += s.priceDeltaMinor;
  }
  const unitsTotal = unitPriceMinor * quantity;
  const discountBps = bulkDiscountBps(product.bulkDiscounts, quantity);
  const discountMinor = Math.round((unitsTotal * discountBps) / 10_000);
  return {
    unitPriceMinor,
    flatFeesMinor,
    discountBps,
    discountMinor,
    lineTotalMinor: unitsTotal - discountMinor + flatFeesMinor,
  };
}

/** "5%" or "2.5%" from basis points. */
export function formatPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}
