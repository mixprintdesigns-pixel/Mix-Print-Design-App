// Pure pricing and configuration rules, shared by the server and the product page.
// Keep this file free of database and Next.js imports so it can run anywhere.

export const MAX_QUANTITY = 100_000;

export type PriceTierInput = { minQuantity: number; unitPriceMinor: number };

export type OptionInput = {
  id: string;
  name: string;
  values: { id: string; label: string; priceDeltaMinor: number }[];
};

export type ProductPricingInput = {
  basePriceMinor: number;
  minQuantity: number;
  quantityStep: number;
  priceTiers: PriceTierInput[];
  options: OptionInput[];
};

export type SelectedOption = {
  optionId: string;
  option: string;
  valueId: string;
  value: string;
  priceDeltaMinor: number;
};

/** Unit price before options: the highest tier at or below the quantity, else the base price. */
export function tierUnitPrice(
  basePriceMinor: number,
  tiers: PriceTierInput[],
  quantity: number,
): number {
  let price = basePriceMinor;
  let matched = 0;
  for (const tier of tiers) {
    if (tier.minQuantity <= quantity && tier.minQuantity >= matched) {
      matched = tier.minQuantity;
      price = tier.unitPriceMinor;
    }
  }
  return price;
}

export function validateQuantity(
  product: Pick<ProductPricingInput, "minQuantity" | "quantityStep">,
  quantity: number,
): string | null {
  if (!Number.isInteger(quantity)) return "Quantity must be a whole number.";
  if (quantity < product.minQuantity)
    return `Minimum order quantity is ${product.minQuantity}.`;
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
  if (chosen.size !== optionValueIds.length)
    return { ok: false, error: "Duplicate option selected." };

  const selection: SelectedOption[] = [];
  for (const option of options) {
    const matches = option.values.filter((v) => chosen.has(v.id));
    if (matches.length !== 1)
      return { ok: false, error: `Please choose one ${option.name}.` };
    const value = matches[0];
    chosen.delete(value.id);
    selection.push({
      optionId: option.id,
      option: option.name,
      valueId: value.id,
      value: value.label,
      priceDeltaMinor: value.priceDeltaMinor,
    });
  }
  if (chosen.size > 0) return { ok: false, error: "Unknown option selected." };
  return { ok: true, selection };
}

/** Stable key so identical configurations of a product merge into one cart line. */
export function configKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join("|");
}

export function linePrice(
  product: Pick<ProductPricingInput, "basePriceMinor" | "priceTiers">,
  selection: SelectedOption[],
  quantity: number,
): { unitPriceMinor: number; lineTotalMinor: number } {
  const unitPriceMinor =
    tierUnitPrice(product.basePriceMinor, product.priceTiers, quantity) +
    selection.reduce((sum, s) => sum + s.priceDeltaMinor, 0);
  return { unitPriceMinor, lineTotalMinor: unitPriceMinor * quantity };
}
