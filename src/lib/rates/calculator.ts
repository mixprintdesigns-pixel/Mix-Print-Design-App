// The size calculator for the rate pages (sign boards, flex, stickers). Pure functions, shared by the page
// (live price) and the server (the order is always recalculated there).
//
// Billing rule: each side is converted to feet and rounded UP to the next whole foot on its own, so any extra
// inch counts as a full foot (3 ft 1 in → 4 ft, 10 ft 3 in → 11 ft, 5 ft → 5 ft).
// Billable sq ft = rounded width × rounded height × quantity.

export const SIZE_UNITS = ["ft-in", "in", "cm", "mm", "m"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export const UNIT_LABELS: Record<SizeUnit, string> = { "ft-in": "Feet + inches", in: "Inches", cm: "cm", mm: "mm", m: "Meters" };

/** One side as typed: `value` is feet for "ft-in" (with `inches` beside it), otherwise the number in that unit. */
export type Side = { value: number; inches?: number };
export type SizeInput = { unit: SizeUnit; width: Side; height: Side; quantity: number };

export const MAX_QUANTITY = 1000;
/** Largest side accepted: 500 ft (about 152 m). */
const MAX_SIDE_INCHES = 500 * 12;

const INCHES_PER: Record<Exclude<SizeUnit, "ft-in">, number> = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4, m: 1 / 0.0254 };

/** The side in inches (exact, before rounding). */
export function sideInInches(side: Side, unit: SizeUnit): number {
  if (unit === "ft-in") return side.value * 12 + (side.inches ?? 0);
  return side.value * INCHES_PER[unit];
}

/** The side in whole feet, rounded up: any part of a foot counts as a full foot. */
export function billableFeet(inches: number): number {
  if (!(inches > 0)) return 0;
  // Cleans up floating-point noise first (152.4 cm is exactly 5 ft, not 5.0000000001 ft).
  const feet = Math.round((inches / 12) * 1e6) / 1e6;
  return Math.ceil(feet);
}

/** How the customer typed the size, e.g. "10 ft 3 in × 5 ft" or "120 cm × 90 cm". */
export function formatSize(input: Pick<SizeInput, "unit" | "width" | "height">): string {
  return `${formatSide(input.width, input.unit)} × ${formatSide(input.height, input.unit)}`;
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

export function formatSide(side: Side, unit: SizeUnit): string {
  if (unit === "ft-in") {
    const ft = side.value || 0;
    const inch = side.inches || 0;
    if (!inch) return `${num(ft)} ft`;
    if (!ft) return `${num(inch)} in`;
    return `${num(ft)} ft ${num(inch)} in`;
  }
  return `${num(side.value || 0)} ${unit === "m" ? "m" : unit}`;
}

/** A problem with the size or quantity, in plain words, or null when everything is fine. */
export function validateSize(input: SizeInput): string | null {
  for (const [name, side] of [["width", input.width], ["height", input.height]] as const) {
    const values = [side.value, side.inches ?? 0];
    if (values.some((v) => !Number.isFinite(v) || v < 0)) return `Enter a valid ${name}.`;
    const inches = sideInInches(side, input.unit);
    if (!(inches > 0)) return `Enter the ${name}.`;
    if (inches > MAX_SIDE_INCHES) return `The ${name} is too large. For very big sizes, please message us on WhatsApp.`;
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return "Quantity must be at least 1.";
  if (input.quantity > MAX_QUANTITY) return `For more than ${MAX_QUANTITY} pieces, please message us on WhatsApp.`;
  return null;
}

export type RateQuote = {
  sizeText: string;
  widthFt: number;
  heightFt: number;
  quantity: number;
  /** Billable square feet for all pieces. */
  sqft: number;
  rateMinor: number;
  /** Area × rate, before any minimum. */
  areaCostMinor: number;
  /** The printing cost charged: the area cost, or the minimum order amount when that is higher. */
  printingMinor: number;
  minimumApplied: boolean;
  designChargeMinor: number;
  totalMinor: number;
};

/** The full price breakdown. Rates and charges are in paisa. */
export function quoteRate(
  input: SizeInput,
  pricing: { rateMinor: number; designChargeMinor: number; minOrderMinor?: number | null },
): { ok: true; quote: RateQuote } | { ok: false; error: string } {
  const error = validateSize(input);
  if (error) return { ok: false, error };
  if (!(pricing.rateMinor > 0)) return { ok: false, error: "This item has no rate yet. Please message us on WhatsApp." };
  const widthFt = billableFeet(sideInInches(input.width, input.unit));
  const heightFt = billableFeet(sideInInches(input.height, input.unit));
  const sqft = widthFt * heightFt * input.quantity;
  const areaCostMinor = Math.round(sqft * pricing.rateMinor);
  const minimum = pricing.minOrderMinor && pricing.minOrderMinor > 0 ? pricing.minOrderMinor : 0;
  const printingMinor = Math.max(areaCostMinor, minimum);
  const designChargeMinor = Math.max(0, pricing.designChargeMinor);
  return {
    ok: true,
    quote: {
      sizeText: formatSize(input),
      widthFt,
      heightFt,
      quantity: input.quantity,
      sqft,
      rateMinor: pricing.rateMinor,
      areaCostMinor,
      printingMinor,
      minimumApplied: printingMinor > areaCostMinor,
      designChargeMinor,
      totalMinor: printingMinor + designChargeMinor,
    },
  };
}

/** Rupees as shown on the rate pages: 4500 paisa → "Rs 45", 4550 → "Rs 45.50", 1250000 → "Rs 12,500". */
export function formatRs(minor: number): string {
  const rupees = minor / 100;
  return `Rs ${rupees.toLocaleString("en-PK", { minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
