import { formatPKR } from "@/lib/money";
import type { CategoryNode } from "@/lib/catalog/tree";
import { formatRs } from "@/lib/rates/calculator";
import type { PriceHint } from "@/lib/rates/queries";

/**
 * The price of a category:
 * - the owner's own starting price, when set: "From PKR 450 per sq. ft";
 * - per-sq-ft items with rates (flex, stickers, sign boards): "From Rs 45 per sq ft", from the rate sections;
 * - otherwise its cheapest product, "From PKR 2.50 / unit";
 * - otherwise "Get Quote" (in the installed app "Price on request", so it is not mistaken for a second button).
 */
export function CategoryPrice({ category, hint, className = "" }: { category: Pick<CategoryNode, "priceFromMinor" | "priceUnit">; hint?: PriceHint; className?: string }) {
  if (category.priceFromMinor != null) {
    return (
      <span className={className}>
        From <span className="font-bold">{formatPKR(category.priceFromMinor)}</span>
        {category.priceUnit && <span className="text-muted"> {category.priceUnit}</span>}
      </span>
    );
  }
  if (hint?.kind === "sqft") {
    return (
      <span className={className} data-testid="price-hint">
        From <span className="font-bold">{formatRs(hint.fromMinor)}</span> <span className="text-muted">per sq ft</span>
      </span>
    );
  }
  if (hint?.kind === "unit") {
    return (
      <span className={className} data-testid="price-hint">
        From <span className="font-bold">{formatPKR(hint.fromMinor)}</span> <span className="text-muted">/ unit</span>
      </span>
    );
  }
  return (
    <span className={`font-semibold text-accent ${className}`}>
      <span className="app:hidden">Get Quote</span>
      <span className="hidden app:inline">Price on request</span>
    </span>
  );
}
