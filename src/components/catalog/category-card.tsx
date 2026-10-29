import Link from "next/link";
import { ServiceVisual } from "@/components/services/service-visual";
import type { CategoryNode } from "@/lib/catalog/tree";
import { CategoryPrice } from "./category-price";

/** A category (main service, category or sub-category) as a card linking one level deeper. */
export function CategoryCard({ category, href, index = 0, headingLevel = 3 }: { category: CategoryNode; href: string; index?: number; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" data-testid="category-card">
      <Link href={href} className="block" tabIndex={-1} aria-hidden>
        <ServiceVisual title={category.name} imageUrl={category.imageUrl} alt={category.imageAlt} index={index} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Heading className="font-bold">
          <Link href={href} className="hover:text-brand">
            {category.name}
          </Link>
        </Heading>
        {category.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{category.description}</p>}
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
    </article>
  );
}
