// The size calculator for the rate sections (flex, stickers, sign boards). Pure functions, shared by the page
// (CHECK) and the server (the order is always recalculated there). All lengths are worked out in inches.
//
// Rule A – Flex, Backlit Flex and all Sign Boards: each side is rounded UP to the next whole foot, separately.
//   6 ft 2 in × 3 ft → 7 × 3 = 21 sq ft · 10 ft 3 in × 5 ft → 11 × 5 = 55 sq ft · 4 ft × 3 ft → 12 sq ft
// Rule B – Stickers (media roll 4.5 ft wide), no whole-foot rounding on the long side:
//   1. both sides ≤ 4.5 ft: the larger side stays exact, the smaller is rounded up to the next whole foot
//      (never more than the 4.5 ft roll): 3 ft 6 in × 4 ft 6 in → 4 × 4.5 = 18 sq ft
//   2. one side ≤ 4.5 ft, the other longer: the short side is charged as 4.5 ft, the long side stays exact
//      (either way round): 3 ft × 6 ft → 27 sq ft · 6 ft 6 in × 3 ft 4 in → 4.5 × 6.5 = 29.25 sq ft
//   3. both sides > 4.5 ft: the Width is rounded up to the next multiple of 4.5 ft, the Height stays exact:
//      14 × 6 → 18 × 6 = 108 · 9 × 6 → 54 · 9 ft 1 in × 6 ft 2 in → 13.5 × 6.1667 ≈ 83.25 sq ft
// Total = billable sq ft × rate + designing charges, rounded to the nearest whole rupee.

export const SIZE_UNITS = ["ft-in", "in", "cm", "mm"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];
export const UNIT_LABELS: Record<SizeUnit, string> = { "ft-in": "ft + in", in: "inches", cm: "cm", mm: "mm" };

export const PRICING_RULES = ["FLEX", "STICKER", "SIGN_BOARD"] as const;
export type PricingRule = (typeof PRICING_RULES)[number];
export const RULE_LABELS: Record<PricingRule, string> = {
  FLEX: "Flex (each side to the next full foot)",
  STICKER: "Sticker (4.5 ft roll width)",
  SIGN_BOARD: "Sign Board (each side to the next full foot)",
};

/** One side as typed: `value` is feet for "ft-in" (with `inches` beside it), otherwise the number in that unit. */
export type Side = { value: number; inches?: number };
export type SizeInput = { unit: SizeUnit; width: Side; height: Side; quantity?: number };

export const ROLL_INCHES = 54; // sticker media roll: 4.5 ft
export const MAX_QUANTITY = 1000;
const MAX_SIDE_INCHES = 500 * 12; // 500 ft

const INCHES_PER: Record<Exclude<SizeUnit, "ft-in">, number> = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 };

/** Removes floating-point noise (152.4 cm is exactly 60 in, not 60.0000000001). */
const clean = (n: number) => Math.round(n * 1e6) / 1e6;
const roundUpTo = (inches: number, step: number) => Math.ceil(clean(inches / step)) * step;

/** The side in inches, exactly as typed. */
export function sideInInches(side: Side, unit: SizeUnit): number {
  if (unit === "ft-in") return clean(side.value * 12 + (side.inches ?? 0));
  return clean(side.value * INCHES_PER[unit]);
}

/** The side in whole feet, rounded up (Rule A). */
export function billableFeet(inches: number): number {
  return inches > 0 ? roundUpTo(inches, 12) / 12 : 0;
}

/** The billable width and height in inches under a pricing rule. */
export function billableSides(widthIn: number, heightIn: number, rule: PricingRule): { width: number; height: number } {
  if (rule !== "STICKER") return { width: roundUpTo(widthIn, 12), height: roundUpTo(heightIn, 12) };
  const w = clean(widthIn);
  const h = clean(heightIn);
  if (w <= ROLL_INCHES && h <= ROLL_INCHES) {
    // Case 1: the smaller side to the next whole foot (at most the roll width), the larger exact
    const up = (n: number) => Math.min(roundUpTo(n, 12), ROLL_INCHES);
    return w < h ? { width: up(w), height: h } : { width: w, height: up(h) };
  }
  if (w <= ROLL_INCHES) return { width: ROLL_INCHES, height: h }; // Case 2: short side = full roll width
  if (h <= ROLL_INCHES) return { width: w, height: ROLL_INCHES };
  return { width: roundUpTo(w, ROLL_INCHES), height: h }; // Case 3: width in whole roll widths
}

const num = (n: number, places = 2) => String(Math.round(n * 10 ** places) / 10 ** places);

/** A length in inches for people: "7 ft", "4.5 ft", "6 ft 2 in", "8 in". */
export function formatLength(inches: number): string {
  const i = clean(inches);
  if (i % 12 === 0) return `${i / 12} ft`;
  if (i % 6 === 0) return `${i / 12} ft`; // 4.5 ft, 13.5 ft
  const ft = Math.floor(i / 12);
  const rest = i - ft * 12;
  return ft ? `${ft} ft ${num(rest)} in` : `${num(rest)} in`;
}

export function formatSide(side: Side, unit: SizeUnit): string {
  if (unit === "ft-in") {
    const ft = side.value || 0;
    const inch = side.inches || 0;
    if (!inch) return `${num(ft, 3)} ft`;
    if (!ft) return `${num(inch, 3)} in`;
    return `${num(ft, 3)} ft ${num(inch, 3)} in`;
  }
  return `${num(side.value || 0, 3)} ${unit}`;
}

/** How the customer typed the size, e.g. "10 ft 3 in × 5 ft" or "120 cm × 90 cm". */
export function formatSize(input: Pick<SizeInput, "unit" | "width" | "height">): string {
  return `${formatSide(input.width, input.unit)} × ${formatSide(input.height, input.unit)}`;
}

/** A problem with the size or quantity, in plain words, or null when everything is fine. */
export function validateSize(input: SizeInput): string | null {
  for (const [name, side] of [["width", input.width], ["height", input.height]] as const) {
    if ([side.value, side.inches ?? 0].some((v) => !Number.isFinite(v) || v < 0)) return `Enter a valid ${name}.`;
    const inches = sideInInches(side, input.unit);
    if (!(inches > 0)) return `Enter the ${name}.`;
    if (inches > MAX_SIDE_INCHES) return `The ${name} is too large. For very big sizes, please message us on WhatsApp.`;
  }
  const q = input.quantity ?? 1;
  if (!Number.isInteger(q) || q < 1) return "Quantity must be at least 1.";
  if (q > MAX_QUANTITY) return `For more than ${MAX_QUANTITY} pieces, please message us on WhatsApp.`;
  return null;
}

export type RateQuote = {
  rule: PricingRule;
  sizeText: string;
  /** Billable size, e.g. "13.5 ft × 6 ft 2 in". */
  billableText: string;
  billableWidthIn: number;
  billableHeightIn: number;
  quantity: number;
  /** Billable square feet for all pieces (exact). */
  sqft: number;
  /** Billable square feet for display, to 2 decimals. */
  sqftText: string;
  rateMinor: number;
  /** Printing cost (sq ft × rate, or the minimum) in paisa; together with the design charge it makes the total. */
  printingMinor: number;
  minimumApplied: boolean;
  designChargeMinor: number;
  /** Rounded to the nearest whole rupee. */
  totalMinor: number;
};

/** The full price. Rates and charges are in paisa. */
export function quoteRate(
  input: SizeInput,
  pricing: { rule: PricingRule; rateMinor: number; designChargeMinor: number; minOrderMinor?: number | null },
): { ok: true; quote: RateQuote } | { ok: false; error: string } {
  const error = validateSize(input);
  if (error) return { ok: false, error };
  if (!(pricing.rateMinor > 0)) return { ok: false, error: "Choose a rate first." };
  const quantity = input.quantity ?? 1;
  const sides = billableSides(sideInInches(input.width, input.unit), sideInInches(input.height, input.unit), pricing.rule);
  const sqft = clean((sides.width * sides.height) / 144) * quantity;
  const areaCost = sqft * pricing.rateMinor;
  const minimum = pricing.minOrderMinor && pricing.minOrderMinor > 0 ? pricing.minOrderMinor : 0;
  const designChargeMinor = Math.max(0, pricing.designChargeMinor);
  const rawTotal = Math.max(areaCost, minimum) + designChargeMinor;
  const totalMinor = Math.round(rawTotal / 100) * 100;
  return {
    ok: true,
    quote: {
      rule: pricing.rule,
      sizeText: formatSize(input),
      billableText: `${formatLength(sides.width)} × ${formatLength(sides.height)}`,
      billableWidthIn: sides.width,
      billableHeightIn: sides.height,
      quantity,
      sqft,
      sqftText: num(sqft),
      rateMinor: pricing.rateMinor,
      printingMinor: totalMinor - designChargeMinor,
      minimumApplied: minimum > areaCost,
      designChargeMinor,
      totalMinor,
    },
  };
}

/** Rupees as shown on the rate pages: 4500 paisa → "Rs 45", 4550 → "Rs 45.50", 1250000 → "Rs 12,500". */
export function formatRs(minor: number): string {
  return `Rs ${rupees(minor)}`;
}

/** A rate on a button: 4500 → "45/-". */
export function formatRateTag(minor: number): string {
  return `${rupees(minor)}/-`;
}

function rupees(minor: number): string {
  return (minor / 100).toLocaleString("en-PK", { minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
