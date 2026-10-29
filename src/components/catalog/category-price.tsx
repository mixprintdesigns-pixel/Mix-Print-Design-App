import { formatPKR } from "@/lib/money";
import type { CategoryNode } from "@/lib/catalog/tree";

/** "From PKR 45 per sq. ft" when the owner has set a starting price, otherwise "Get Quote". */
export function CategoryPrice({ category, className = "" }: { category: Pick<CategoryNode, "priceFromMinor" | "priceUnit">; className?: string }) {
  if (category.priceFromMinor == null) {
    return <span className={`font-semibold text-accent ${className}`}>Get Quote</span>;
  }
  return (
    <span className={className}>
      From <span className="font-bold">{formatPKR(category.priceFromMinor)}</span>
      {category.priceUnit && <span className="text-muted"> {category.priceUnit}</span>}
    </span>
  );
}
