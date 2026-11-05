import Link from "next/link";
import { AppCardActions } from "@/components/app/app-card-actions";
import { ServiceVisual } from "@/components/services/service-visual";
import type { CategoryNode } from "@/lib/catalog/tree";
import type { PriceHint } from "@/lib/rates/queries";
import { CategoryPrice } from "./category-price";

/** App-mode photo card classes, shared with the Services page (see .app-tile in globals.css). */
export const APP_ROW_CARD = "app-tile";
export const APP_ROW_VISUAL = "";

/**
 * A category (main service, category or sub-category) as a card linking one level deeper.
 * In the installed app it is a tall photo card: the picture fills it, the name and price sit on a dark gradient,
 * a round button opens it (or WhatsApp when the price is on request), and the whole card is tappable.
 */
export function CategoryCard({
  category,
  href,
  index = 0,
  headingLevel = 3,
  priceHint,
}: {
  category: CategoryNode;
  href: string;
  index?: number;
  headingLevel?: 2 | 3;
  /** Its price (rates per sq ft, or its cheapest product): see CategoryPrice. */
  priceHint?: PriceHint;
}) {
  const Heading = `h${headingLevel}` as const;
  const priceOnRequest = !priceHint && category.priceFromMinor == null;
  return (
    <article className={`card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${APP_ROW_CARD}`} data-testid="category-card">
      <Link href={href} className="app-tile-media block" tabIndex={-1} aria-hidden>
        <ServiceVisual
          title={category.name}
          imageUrl={category.imageUrl}
          alt={category.imageAlt}
          index={index}
          sizes="(min-width: 1024px) 33vw, (display-mode: standalone) 50vw, 100vw"
          className={APP_ROW_VISUAL}
          initialsClassName="app:hidden"
        />
      </Link>
      <div className="app-tile-body flex flex-1 flex-col p-4">
        <Heading className="app-card-title font-bold">
          <Link href={href} className="app-tile-link hover:text-brand">
            {category.name}
          </Link>
        </Heading>
        {category.description && <p className="app-card-text app-tile-hide mt-1 line-clamp-3 text-sm text-muted">{category.description}</p>}
        <p className="app-tile-price mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
          <CategoryPrice category={category} hint={priceHint} />
          <span className="app-tile-hide text-muted">
            {category.children.length > 0
              ? `${category.children.length} ${category.children.length === 1 ? "type" : "types"}`
              : category.productCount > 0
                ? `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`
                : ""}
          </span>
        </p>
        {/* Per-sq-ft items: straight to the calculator on their page */}
        {priceHint?.kind === "sqft" && (
          <Link href={`${href}#rates`} className="app-tile-hide btn-secondary mt-3 w-full py-2" data-testid="check-price">
            Check price<span className="sr-only"> of {category.name}</span>
          </Link>
        )}
      </div>
      <AppCardActions href={priceHint?.kind === "sqft" ? `${href}#rates` : href} subject={category.name} priceOnRequest={priceOnRequest} />
    </article>
  );
}
