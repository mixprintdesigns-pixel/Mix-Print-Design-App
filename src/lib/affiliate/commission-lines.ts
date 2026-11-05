import { formatPKR } from "@/lib/money";

// Readable lines for per-sq-ft commissions (rate calculator orders), from the commission's saved breakdown:
// "55 sq ft × PKR 5" and, when reached, "Big-order bonus (500+ sq ft)". Empty for ordinary product commissions.

type Line = { perSqft?: boolean; bonus?: boolean; productName?: string; sqft?: number; perSqftMinor?: number; commissionMinor?: number };

export function perSqftCommissionLines(breakdown: unknown): { label: string; amountMinor: number }[] {
  if (!Array.isArray(breakdown)) return [];
  return (breakdown as Line[])
    .filter((l) => l?.perSqft)
    .map((l) => ({
      label: l.bonus ? (l.productName ?? "Big-order bonus") : `${Math.round((l.sqft ?? 0) * 100) / 100} sq ft × ${formatPKR(l.perSqftMinor ?? 0)}`,
      amountMinor: l.commissionMinor ?? 0,
    }));
}
