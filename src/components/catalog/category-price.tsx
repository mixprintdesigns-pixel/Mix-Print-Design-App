import { formatPKR } from "@/lib/money";
import type { CategoryNode } from "@/lib/catalog/tree";

/**
 * "From PKR 45 per sq. ft" when the owner has set a starting price, otherwise "Get Quote"
 * (in the installed app "Price on request", so it is not mistaken for a second button).
 */
export function CategoryPrice({ category, className = "" }: { category: Pick<CategoryNode, "priceFromMinor" | "priceUnit">; className?: string }) {
  if (category.priceFromMinor == null) {
    return (
      <span className={`font-semibold text-accent ${className}`}>
        <span className="app:hidden">Get Quote</span>
        <span className="hidden app:inline">Price on request</span>
      </span>
    );
  }
  return (
    <span className={className}>
      From <span className="font-bold">{formatPKR(category.priceFromMinor)}</span>
      {category.priceUnit && <span className="text-muted"> {category.priceUnit}</span>}
    </span>
  );
}
