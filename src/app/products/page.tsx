import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryTreeNav } from "@/components/catalog/category-tree-nav";
import { ProductGridSkeleton, ProductListing } from "@/components/catalog/product-listing";
import { getCategoryTree } from "@/lib/catalog/queries";
import { categoryUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";

// Search, sort and filter links (/products?q=…) all share this canonical URL.
export const generateMetadata = () => pageMetadata("products");

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const tree = await getCategoryTree();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ name: "Products", href: "/products" }]} />
      <h1 className="mt-2 text-3xl font-bold">All products</h1>
      <p className="mt-1 max-w-3xl text-muted">
        Everything we print, grouped by service. Pick a category on the left, or search below. Items without a listed price can be quoted on WhatsApp.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <CategoryTreeNav tree={tree} hrefFor={(n) => categoryUrl(n.path)} allLabel="All products" allHref="/products" />
        </aside>
        <section aria-label="Products">
          <nav className="mb-5 flex flex-wrap gap-2" aria-label="Shop by service">
            {tree.map((service) => (
              <Link
                key={service.id}
                href={categoryUrl(service.path)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand"
              >
                {service.name} <span className="opacity-70">({service.productCount})</span>
              </Link>
            ))}
          </nav>
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductListing category={null} searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
