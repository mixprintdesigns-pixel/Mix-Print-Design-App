// Pure commission rules, kept free of database code so they are easy to test and audit.

export type CommissionItemInput = {
  productId: string | null;
  productName: string;
  lineTotalMinor: number;
  /** Product-specific rate (Product.affiliateCommissionBps), if set. */
  productRateBps: number | null;
  /** Fixed commission in paisa per order of this product (Product.affiliateCommissionMinor); takes precedence over rates. */
  productFixedMinor?: number | null;
};

export type CommissionBreakdownItem = {
  productId: string | null;
  productName: string;
  baseMinor: number;
  rateBps: number;
  /** Set when the product pays a fixed amount per order instead of a percentage. */
  fixedMinor?: number;
  commissionMinor: number;
};

export type CommissionCalculation = {
  baseAmountMinor: number;
  amountMinor: number;
  breakdown: CommissionBreakdownItem[];
};

/**
 * Precedence: product's fixed Rs amount (per order of that product, any quantity, never more than
 * the line total) → product rate → affiliate's custom rate → program default.
 * The base is each item's line total. Order-level discounts are shared across items in
 * proportion to their totals; shipping never earns commission.
 */
export function calculateCommission(
  items: CommissionItemInput[],
  rates: { affiliateRateBps: number | null; defaultRateBps: number },
  orderDiscountMinor = 0,
): CommissionCalculation {
  const subtotal = items.reduce((sum, i) => sum + i.lineTotalMinor, 0);
  const discount = Math.min(Math.max(orderDiscountMinor, 0), subtotal);

  const breakdown = items.map((item) => {
    const share = subtotal > 0 ? Math.round((discount * item.lineTotalMinor) / subtotal) : 0;
    const baseMinor = Math.max(item.lineTotalMinor - share, 0);
    const rateBps = item.productRateBps ?? rates.affiliateRateBps ?? rates.defaultRateBps;
    if (item.productFixedMinor != null) {
      const fixed = Math.min(item.productFixedMinor, baseMinor);
      return {
        productId: item.productId,
        productName: item.productName,
        baseMinor,
        rateBps: baseMinor > 0 ? Math.round((fixed * 10_000) / baseMinor) : 0,
        fixedMinor: item.productFixedMinor,
        commissionMinor: fixed,
      };
    }
    return {
      productId: item.productId,
      productName: item.productName,
      baseMinor,
      rateBps,
      commissionMinor: Math.floor((baseMinor * rateBps) / 10_000),
    };
  });

  return {
    baseAmountMinor: breakdown.reduce((s, b) => s + b.baseMinor, 0),
    amountMinor: breakdown.reduce((s, b) => s + b.commissionMinor, 0),
    breakdown,
  };
}

/** Referral codes: 4–20 letters/digits, stored upper-case. */
export function normalizeCode(code: string): string | null {
  const c = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(c) ? c : null;
}

/** Only same-site paths are allowed as referral landing pages (prevents open redirects). */
export function safeLandingPath(to: string | null | undefined): string {
  if (!to || !to.startsWith("/") || to.startsWith("//") || to.includes("\\") || to.startsWith("/r/")) return "/";
  return to.slice(0, 300);
}

/** "Rs 200 on Rs 5,000" → 400 basis points (4%), for showing a fixed commission as a percentage. */
export function fixedCommissionPercentBps(commissionMinor: number, priceMinor: number): number | null {
  return priceMinor > 0 ? Math.round((commissionMinor * 10_000) / priceMinor) : null;
}
