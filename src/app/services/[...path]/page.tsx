import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryCard } from "@/components/catalog/category-card";
import { CategoryContent } from "@/components/catalog/category-content";
import { CategoryPrice } from "@/components/catalog/category-price";
import { JsonLd } from "@/components/catalog/json-ld";
import { ProductCard } from "@/components/product-card";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getCatalogPaths, getCategoryTree, listProducts, type CategoryNode } from "@/lib/catalog/queries";
import { ancestry, categoryUrl, defaultCategoryTitle, findByPath, metaDescription, serviceUrl, siblings } from "@/lib/catalog/tree";
import { absoluteUrl, seoMetadata } from "@/lib/seo";

type Params = PageProps<"/services/[...path]">["params"];

const PRODUCTS_SHOWN = 6;

export async function generateStaticParams() {
  const { categories } = await getCatalogPaths();
  // Cache Components needs at least one entry to validate the route; an unknown path renders the 404 page.
  return categories.length > 0 ? categories.map((c) => ({ path: c.path })) : [{ path: ["catalog-empty"] }];
}

async function findService(params: Params) {
  const tree = await getCategoryTree();
  const node = findByPath(tree, (await params).path);
  return node ? { tree, node } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await findService(params);
  if (!found) return { title: "Page not found", robots: { index: false } };
  const { tree, node } = found;
  return seoMetadata({
    title: node.seoTitle || defaultCategoryTitle(node, ancestry(tree, node)),
    description: node.seoDescription || metaDescription(node.description || node.content),
    path: serviceUrl(node.path),
    images: node.imageUrl ? [{ url: node.imageUrl, alt: node.imageAlt ?? node.name }] : undefined,
  });
}

export default function ServicePathPage({ params }: PageProps<"/services/[...path]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-6xl animate-pulse rounded-xl bg-surface" />}>
      <ServicePath params={params} />
    </Suspense>
  );
}

// The URL is read inside <Suspense> so every path gets an instant static shell (Cache Components).
// Unknown paths render the 404 page, which Next.js marks "noindex".
async function ServicePath({ params }: { params: Params }) {
  const found = await findService(params);
  if (!found) notFound();
  return <ServiceDetail tree={found.tree} node={found.node} />;
}

function serviceJsonLd(node: CategoryNode, chain: CategoryNode[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: node.name,
    serviceType: chain.map((c) => c.name).join(" › "),
    description: node.description ?? undefined,
    url: absoluteUrl(serviceUrl(node.path)),
    image: node.imageUrl ? absoluteUrl(node.imageUrl) : undefined,
    areaServed: { "@type": "City", name: "Lahore" },
    provider: { "@id": `${absoluteUrl("/")}#business` },
    ...(node.priceFromMinor != null
      ? { offers: { "@type": "Offer", priceCurrency: "PKR", price: node.priceFromMinor / 100, description: node.priceUnit ?? undefined } }
      : {}),
  };
}

async function ServiceDetail({ tree, node }: { tree: CategoryNode[]; node: CategoryNode }) {
  const chain = ancestry(tree, node);
  const subject = chain.map((c) => c.name).join(" / ");
  const products = await listProducts({ categoryId: node.id });
  const related = siblings(tree, node).slice(0, 6);

  return (
    <>
      <JsonLd data={serviceJsonLd(node, chain)} />
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
          <div>
            <Breadcrumbs items={[{ name: "Services", href: "/services" }, ...chain.map((c) => ({ name: c.name, href: serviceUrl(c.path) }))]} />
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{node.name}</h1>
            {node.description && <p className="mt-3 text-lg text-muted">{node.description}</p>}
            <p className="mt-3">
              <CategoryPrice category={node} />
            </p>
            <div className="mt-5">
              <QuoteButtons subject={subject} />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl">
            <ServiceVisual title={node.name} imageUrl={node.imageUrl} alt={node.imageAlt} priority sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        {node.children.length > 0 && (
          <section aria-labelledby="types-heading">
            <h2 id="types-heading" className="text-2xl font-bold">
              {node.name} types
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {node.children.map((c, i) => (
                <CategoryCard key={c.id} category={c} href={serviceUrl(c.path)} index={i + 1} />
              ))}
            </div>
          </section>
        )}

        {products.length > 0 && (
          <section aria-labelledby="products-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="products-heading" className="text-2xl font-bold">
                {node.name} products
              </h2>
              <Link href={categoryUrl(node.path)} className="text-sm font-semibold text-brand">
                View all {products.length} in Products →
              </Link>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, PRODUCTS_SHOWN).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {node.content && (
          <section className="max-w-3xl" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-2xl font-bold">
              About our {node.name} service
            </h2>
            <CategoryContent content={node.content} className="mt-3" />
          </section>
        )}

        <section className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-br from-brand/10 to-accent/10 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Need a custom size or design?</h2>
            <p className="text-muted">Tell us the size, quantity and deadline. We usually reply within working hours.</p>
          </div>
          <QuoteButtons subject={subject} />
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-bold">
              Related services
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c, i) => (
                <CategoryCard key={c.id} category={c} href={serviceUrl(c.path)} index={i + 2} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
