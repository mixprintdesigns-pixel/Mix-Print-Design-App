import Link from "next/link";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ProductCard } from "@/components/product-card";
import { listProducts, parseProductFilter, SORTS } from "@/lib/catalog/queries";
import { categoryUrl, type CategoryNode } from "@/lib/catalog/tree";

/**
 * Search, filters, sub-category chips and the product grid for /products and /products/<category path>.
 * Products in all sub-categories of the selected category are included.
 * Must render inside <Suspense> (it reads the query string).
 */
export async function ProductListing({
  category,
  searchParams,
}: {
  category: CategoryNode | null;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseProductFilter(await searchParams);
  const products = await listProducts({ ...filter, categoryId: category?.id });
  const action = categoryUrl(category?.path ?? []);
  const filtered = Boolean(filter.q || filter.maxDays || filter.inStock || filter.sort !== "featured");

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action={action} className="flex flex-1 gap-2" role="search">
          <input
            type="search"
            name="q"
            defaultValue={filter.q}
            placeholder={category ? `Search in ${category.name}` : "Search products or SKU"}
            className="input"
            aria-label="Search"
          />
          <button className="btn-secondary">Search</button>
        </form>
        <form action={action} className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filters">
          {filter.q && <input type="hidden" name="q" value={filter.q} />}
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <AutoSubmitSelect id="sort" name="sort" defaultValue={filter.sort} className="input w-auto py-2">
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AutoSubmitSelect>
          <label htmlFor="maxDays" className="sr-only">
            Production time
          </label>
          <AutoSubmitSelect id="maxDays" name="maxDays" defaultValue={filter.maxDays ?? ""} className="input w-auto py-2">
            <option value="">Any production time</option>
            <option value="2">Within 2 working days</option>
            <option value="3">Within 3 working days</option>
            <option value="5">Within 5 working days</option>
          </AutoSubmitSelect>
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <input type="checkbox" name="inStock" value="1" defaultChecked={filter.inStock} />
            In stock
          </label>
          <button className="btn-secondary py-2">Apply</button>
        </form>
      </div>

      <p className="mt-4 text-sm text-muted" role="status">
        {products.length} {products.length === 1 ? "product" : "products"}
        {filter.q ? ` matching “${filter.q}”` : ""}
        {filtered && (
          <>
            {" · "}
            <Link href={action} className="font-semibold text-brand">
              Clear filters
            </Link>
          </>
        )}
      </p>

      {products.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-muted">
          {filtered ? "No products match your filters." : "Products for this category are coming soon. Ask us for a quote in the meantime."}
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-72 animate-pulse" />
      ))}
    </div>
  );
}
