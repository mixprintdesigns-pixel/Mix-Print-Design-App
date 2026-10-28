import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { getCategories, listProducts } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "All products" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Products</h1>
      <Suspense fallback={<ProductGridSkeleton />}>
        <FilteredCatalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FilteredCatalog({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;
  const [categories, products] = await Promise.all([getCategories(), listProducts({ category, q })]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Categories">
          <CategoryPill href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"} active={!category}>
            All
          </CategoryPill>
          {categories.map((c) => (
            <CategoryPill
              key={c.id}
              href={`/products?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              active={category === c.slug}
            >
              {c.name}
            </CategoryPill>
          ))}
        </nav>
        <form action="/products" className="flex gap-2" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          <input type="search" name="q" defaultValue={q} placeholder="Search products" className="input md:w-64" aria-label="Search" />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-muted">No products match your search.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}

function CategoryPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"
      }`}
    >
      {children}
    </Link>
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
