import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryCard } from "@/components/catalog/category-card";
import { CategoryContent } from "@/components/catalog/category-content";
import { CategoryPrice } from "@/components/catalog/category-price";
import { CategoryTreeNav } from "@/components/catalog/category-tree-nav";
import { JsonLd } from "@/components/catalog/json-ld";
import { ProductGridSkeleton, ProductListing } from "@/components/catalog/product-listing";
import { ProductCard } from "@/components/product-card";
import { ProductConfigurator } from "@/components/product-configurator";
import { ProductGallery } from "@/components/product-gallery";
import { QuoteButtons } from "@/components/services/quote-buttons";
import {
  getCatalogPaths,
  getCategoryTree,
  getRelatedProducts,
  resolveCatalogPath,
  startingUnitPrice,
  type CategoryNode,
  type ProductDetail,
} from "@/lib/catalog/queries";
import { ancestry, categoryUrl, defaultCategoryTitle, metaDescription, serviceUrl, siblings } from "@/lib/catalog/tree";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";
import { absoluteUrl, SITE_NAME, seoMetadata } from "@/lib/seo";

type Params = PageProps<"/products/[...path]">["params"];

/** Every category and product page is generated ahead of time; new ones are generated on their first visit. */
export async function generateStaticParams() {
  const { categories, products } = await getCatalogPaths();
  const paths = [...categories, ...products].map((p) => ({ path: p.path }));
  // Cache Components needs at least one entry to validate the route; an unknown path renders the 404 page.
  return paths.length > 0 ? paths : [{ path: ["catalog-empty"] }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const resolved = await resolveCatalogPath((await params).path);
  if (!resolved) return { title: "Page not found", robots: { index: false } };

  if (resolved.kind === "category") {
    const { node } = resolved;
    const tree = await getCategoryTree();
    return seoMetadata({
      title: node.seoTitle || defaultCategoryTitle(node, ancestry(tree, node)),
      description: node.seoDescription || metaDescription(node.description || node.content),
      path: categoryUrl(node.path),
      images: node.imageUrl ? [{ url: node.imageUrl, alt: node.imageAlt ?? node.name }] : undefined,
    });
  }

  const { product, canonical } = resolved;
  return seoMetadata({
    title: product.seoTitle || `${product.name} in Lahore | ${SITE_NAME}`,
    description: product.seoDescription || metaDescription(product.summary || product.description),
    path: canonical,
    images: product.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })),
  });
}

export default function CatalogPathPage({ params, searchParams }: PageProps<"/products/[...path]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-[32rem] animate-pulse" />}>
        <CatalogPath params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// The URL is read inside <Suspense> so every path gets an instant static shell (Cache Components).
// Unknown paths render the 404 page, which Next.js marks "noindex".
async function CatalogPath({ params, searchParams }: { params: Params; searchParams: PageProps<"/products/[...path]">["searchParams"] }) {
  const resolved = await resolveCatalogPath((await params).path);
  if (!resolved) notFound();
  const tree = await getCategoryTree();
  return resolved.kind === "category" ? (
    <CategoryView node={resolved.node} tree={tree} searchParams={searchParams} />
  ) : (
    <ProductView product={resolved.product} category={resolved.category} tree={tree} canonical={resolved.canonical} />
  );
}

function crumbsFor(tree: CategoryNode[], node: CategoryNode) {
  return [{ name: "Products", href: "/products" }, ...ancestry(tree, node).map((c) => ({ name: c.name, href: categoryUrl(c.path) }))];
}

function CategoryView({
  node,
  tree,
  searchParams,
}: {
  node: CategoryNode;
  tree: CategoryNode[];
  searchParams: PageProps<"/products/[...path]">["searchParams"];
}) {
  const chain = ancestry(tree, node);
  const subject = chain.map((c) => c.name).join(" / ");
  const related = siblings(tree, node).slice(0, 6);

  return (
    <>
      <Breadcrumbs items={crumbsFor(tree, node)} />
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{node.name}</h1>
          {node.description && <p className="mt-1 max-w-3xl text-muted">{node.description}</p>}
          <p className="mt-2 text-sm">
            <CategoryPrice category={node} /> ·{" "}
            <Link href={serviceUrl(node.path)} className="font-semibold text-brand">
              See {node.name} service details
            </Link>
          </p>
        </div>
        <QuoteButtons subject={subject} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <CategoryTreeNav tree={tree} activePath={node.path} hrefFor={(n) => categoryUrl(n.path)} allLabel="All products" allHref="/products" />
        </aside>
        <section aria-label={`${node.name} products`}>
          {node.children.length > 0 && (
            <nav className="mb-5 flex flex-wrap gap-2" aria-label={`${node.name} types`}>
              {node.children.map((c) => (
                <Link
                  key={c.id}
                  href={categoryUrl(c.path)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand"
                >
                  {c.name} <span className="opacity-70">({c.productCount})</span>
                </Link>
              ))}
            </nav>
          )}
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductListing category={node} searchParams={searchParams} />
          </Suspense>
        </section>
      </div>

      {node.content && (
        <section className="mt-12 max-w-3xl" aria-labelledby="about-category">
          <h2 id="about-category" className="text-xl font-bold">
            About {node.name}
          </h2>
          <CategoryContent content={node.content} className="mt-3" />
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-categories">
          <h2 id="related-categories" className="text-xl font-bold">
            Related categories
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((c, i) => (
              <CategoryCard key={c.id} category={c} href={categoryUrl(c.path)} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function productJsonLd(product: ProductDetail, canonical: string, category: CategoryNode) {
  const low = startingUnitPrice(product) / 100;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.summary || product.description.slice(0, 500),
    image: product.images.map((i) => absoluteUrl(i.url)),
    category: category.name,
    brand: { "@type": "Brand", name: SITE_NAME },
    url: absoluteUrl(canonical),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PKR",
      lowPrice: low,
      highPrice: Math.max(low, product.basePriceMinor / 100),
      offerCount: Math.max(1, product.priceTiers.length),
      availability: product.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(canonical),
      seller: { "@id": `${absoluteUrl("/")}#business` },
    },
  };
}

async function ProductView({ product, category, tree, canonical }: { product: ProductDetail; category: CategoryNode; tree: CategoryNode[]; canonical: string }) {
  const related = await getRelatedProducts(product.id, category.id);
  const relatedCategories = [...category.children, ...siblings(tree, category)].slice(0, 6);

  return (
    <>
      <Breadcrumbs items={[...crumbsFor(tree, category), { name: product.name, href: canonical }]} className="mb-6" />
      <JsonLd data={productJsonLd(product, canonical, category)} />
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} />
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.summary && <p className="mt-2 text-lg text-muted">{product.summary}</p>}
          <p className="mt-2 text-sm text-muted">
            SKU {product.sku} · Ready in about {product.turnaroundDays} working days after proof approval.
          </p>
          {product.isAvailable ? (
            <ProductConfigurator
              product={{
                id: product.id,
                basePriceMinor: product.basePriceMinor,
                minQuantity: product.minQuantity,
                quantityStep: product.quantityStep,
                priceTiers: product.priceTiers,
                bulkDiscounts: product.bulkDiscounts,
                options: product.options,
              }}
            />
          ) : (
            <p className="card mt-6 p-5 font-medium" role="status">
              This product is temporarily unavailable. Please check back soon or contact us for a quote.
            </p>
          )}
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold">About this product</h2>
          <div className="mt-3 whitespace-pre-line leading-relaxed text-muted">{product.description}</div>
          <p className="mt-4 text-sm">
            More in{" "}
            <Link href={categoryUrl(category.path)} className="font-semibold text-brand">
              {category.name}
            </Link>
          </p>
        </div>
        {(product.priceTiers.length > 0 || product.bulkDiscounts.length > 0) && (
          <div className="card h-fit p-5">
            <h2 className="font-bold">Volume pricing</h2>
            {product.priceTiers.length > 0 && (
              <>
                <p className="mt-1 text-xs text-muted">Base unit price, before options.</p>
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {product.priceTiers.map((t) => (
                      <tr key={t.minQuantity} className="border-t border-border">
                        <td className="py-2">{t.minQuantity.toLocaleString()}+ units</td>
                        <td className="py-2 text-right font-semibold">{formatPKR(t.unitPriceMinor)} each</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {product.bulkDiscounts.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm" aria-label="Bulk discounts">
                {product.bulkDiscounts.map((d) => (
                  <li key={d.minQuantity} className="rounded-lg bg-accent/10 px-3 py-2">
                    <span className="font-semibold">{formatPercent(d.percentBps)} off</span> orders of{" "}
                    {d.minQuantity.toLocaleString()}+ units
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-products">
          <h2 id="related-products" className="text-xl font-bold">
            Related products
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {relatedCategories.length > 0 && (
        <nav className="mt-12" aria-labelledby="related-categories">
          <h2 id="related-categories" className="text-xl font-bold">
            Related categories
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {relatedCategories.map((c) => (
              <li key={c.id}>
                <Link href={categoryUrl(c.path)} className="block rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
