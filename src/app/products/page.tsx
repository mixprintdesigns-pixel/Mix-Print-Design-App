import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ProductCard } from "@/components/product-card";
import {
  getCategoryTree,
  listProducts,
  parseProductFilter,
  SORTS,
  type CategoryNode,
  type ProductFilter,
} from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "All products" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<ProductGridSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Builds a /products URL that keeps the current filters and applies `changes`. */
function catalogHref(filter: ProductFilter, changes: Partial<Record<keyof ProductFilter, string | undefined>>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    category: filter.category,
    q: filter.q,
    sort: filter.sort === "featured" ? undefined : filter.sort,
    maxDays: filter.maxDays?.toString(),
    inStock: filter.inStock ? "1" : undefined,
    ...changes,
  };
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

function findPath(tree: CategoryNode[], slug: string, path: CategoryNode[] = []): CategoryNode[] | null {
  for (const node of tree) {
    if (node.slug === slug) return [...path, node];
    const found = findPath(node.children, slug, [...path, node]);
    if (found) return found;
  }
  return null;
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const filter = parseProductFilter(await searchParams);
  const [tree, products] = await Promise.all([getCategoryTree(), listProducts(filter)]);
  const path = filter.category ? (findPath(tree, filter.category) ?? []) : [];
  const current = path.at(-1);
  // Show the subcategories of the selected category, or of its parent for a leaf category.
  const subcategories = current?.children.length ? current.children : (path.at(-2)?.children ?? []);

  return (
    <>
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/products" className="hover:text-foreground">
          All products
        </Link>
        {path.map((c) => (
          <span key={c.id}>
            {" / "}
            <Link href={catalogHref(filter, { category: c.slug })} className="hover:text-foreground">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>
      <h1 className="mt-2 text-3xl font-bold">{current?.name ?? "All products"}</h1>
      {current?.description && <p className="mt-1 text-muted">{current.description}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-6">
          <nav aria-label="Categories">
            <p className="mb-2 text-sm font-semibold">Categories</p>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href={catalogHref(filter, { category: undefined })}
                  aria-current={!filter.category ? "page" : undefined}
                  className={!filter.category ? "font-semibold text-brand" : "hover:text-brand"}
                >
                  All products
                </Link>
              </li>
              {tree.map((c) => (
                <CategoryLink key={c.id} node={c} filter={filter} depth={0} />
              ))}
            </ul>
          </nav>

          <form action="/products" className="space-y-4 text-sm" aria-label="Filters">
            {filter.category && <input type="hidden" name="category" value={filter.category} />}
            {filter.q && <input type="hidden" name="q" value={filter.q} />}
            {filter.sort !== "featured" && <input type="hidden" name="sort" value={filter.sort} />}
            <div>
              <label htmlFor="maxDays" className="label">
                Production time
              </label>
              <AutoSubmitSelect id="maxDays" name="maxDays" defaultValue={filter.maxDays ?? ""} className="input">
                <option value="">Any</option>
                <option value="2">Within 2 working days</option>
                <option value="3">Within 3 working days</option>
                <option value="5">Within 5 working days</option>
              </AutoSubmitSelect>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="inStock" value="1" defaultChecked={filter.inStock} />
              Available to order now
            </label>
            <button className="btn-secondary w-full">Apply filters</button>
          </form>
        </aside>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form action="/products" className="flex flex-1 gap-2" role="search">
              {filter.category && <input type="hidden" name="category" value={filter.category} />}
              <input
                type="search"
                name="q"
                defaultValue={filter.q}
                placeholder="Search products or SKU"
                className="input"
                aria-label="Search"
              />
              <button className="btn-secondary">Search</button>
            </form>
            <form action="/products" className="flex items-center gap-2 text-sm">
              {filter.category && <input type="hidden" name="category" value={filter.category} />}
              {filter.q && <input type="hidden" name="q" value={filter.q} />}
              {filter.maxDays && <input type="hidden" name="maxDays" value={filter.maxDays} />}
              {filter.inStock && <input type="hidden" name="inStock" value="1" />}
              <label htmlFor="sort" className="whitespace-nowrap text-muted">
                Sort by
              </label>
              <AutoSubmitSelect id="sort" name="sort" defaultValue={filter.sort} className="input py-2">
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AutoSubmitSelect>
              <noscript>
                <button className="btn-secondary">Sort</button>
              </noscript>
            </form>
          </div>

          {subcategories.length > 0 && (
            <nav className="mt-4 flex flex-wrap gap-2" aria-label="Subcategories">
              {subcategories.map((c) => (
                <Link
                  key={c.id}
                  href={catalogHref(filter, { category: c.slug })}
                  aria-current={c.slug === filter.category ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    c.slug === filter.category ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"
                  }`}
                >
                  {c.name} <span className="opacity-70">({c.productCount})</span>
                </Link>
              ))}
            </nav>
          )}

          <p className="mt-4 text-sm text-muted" role="status">
            {products.length} {products.length === 1 ? "product" : "products"}
            {filter.q ? ` matching “${filter.q}”` : ""}
          </p>

          {products.length === 0 ? (
            <div className="card mt-4 p-8 text-center text-muted">
              No products match your filters.{" "}
              <Link href="/products" className="font-semibold text-brand">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function CategoryLink({ node, filter, depth }: { node: CategoryNode; filter: ProductFilter; depth: number }) {
  const active = node.slug === filter.category;
  return (
    <>
      <li style={{ paddingLeft: `${depth * 0.75}rem` }}>
        <Link
          href={catalogHref(filter, { category: node.slug })}
          aria-current={active ? "page" : undefined}
          className={active ? "font-semibold text-brand" : "hover:text-brand"}
        >
          {node.name} <span className="text-muted">({node.productCount})</span>
        </Link>
      </li>
      {node.children.map((child) => (
        <CategoryLink key={child.id} node={child} filter={filter} depth={depth + 1} />
      ))}
    </>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card h-72 animate-pulse" />
      ))}
    </div>
  );
}
