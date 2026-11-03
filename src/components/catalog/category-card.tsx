import Link from "next/link";
import { AppCardActions } from "@/components/app/app-card-actions";
import { ServiceVisual } from "@/components/services/service-visual";
import type { CategoryNode } from "@/lib/catalog/tree";
import { CategoryPrice } from "./category-price";

/** Compact app-mode shape shared with the Services page: a square picture on the left, text on the right. */
export const APP_ROW_CARD = "app:grid app:grid-cols-[6.5rem_minmax(0,1fr)] app:hover:translate-y-0";
export const APP_ROW_VISUAL = "app:aspect-square app:rounded-xl";

/**
 * A category (main service, category or sub-category) as a card linking one level deeper.
 * In the installed app it is a compact row (square picture left, text right) with one "View" + WhatsApp action row.
 */
export function CategoryCard({ category, href, index = 0, headingLevel = 3 }: { category: CategoryNode; href: string; index?: number; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className={`card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${APP_ROW_CARD}`} data-testid="category-card">
      <Link href={href} className="block app:p-3 app:pr-0" tabIndex={-1} aria-hidden>
        <ServiceVisual title={category.name} imageUrl={category.imageUrl} alt={category.imageAlt} index={index} sizes="(min-width: 1024px) 33vw, (display-mode: standalone) 120px, 100vw" className={APP_ROW_VISUAL} initialsClassName="app:text-2xl" />
      </Link>
      <div className="flex flex-1 flex-col p-4 app:p-3 app:pl-4">
        <Heading className="app-card-title font-bold">
          <Link href={href} className="hover:text-brand">
            {category.name}
          </Link>
        </Heading>
        {category.description && <p className="app-card-text mt-1 line-clamp-3 text-sm text-muted app:line-clamp-2">{category.description}</p>}
        <p className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
          <CategoryPrice category={category} />
          <span className="text-muted">
            {category.children.length > 0
              ? `${category.children.length} ${category.children.length === 1 ? "type" : "types"}`
              : category.productCount > 0
                ? `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`
                : ""}
          </span>
        </p>
      </div>
      <AppCardActions href={href} subject={category.name} className="app:col-span-2 app:px-3 app:pb-3" />
    </article>
  );
}
