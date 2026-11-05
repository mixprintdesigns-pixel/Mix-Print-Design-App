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
import { RateSections } from "@/components/rates/rate-section";
import { getPriceHints, getRateContent, getRateIndex, rateFromMinor } from "@/lib/rates/queries";
import { formatRs } from "@/lib/rates/calculator";
import { CategoryGallery } from "@/components/catalog/category-gallery";
import { getCategoryGallery } from "@/lib/catalog/gallery";
import { WallpaperGallery } from "@/components/wallpaper/wallpaper-gallery";
import { findWallpaperCategoryPage, getWallpaperGallery, isWallpaperService } from "@/lib/wallpaper/queries";
import { getCatalogPaths, getCategoryTree, listProducts, type CategoryNode } from "@/lib/catalog/queries";
import { ancestry, categoryUrl, defaultCategoryTitle, findByPath, metaDescription, serviceUrl, siblings } from "@/lib/catalog/tree";
import { absoluteUrl, seoMetadata } from "@/lib/seo";

type Params = PageProps<"/services/[...path]">["params"];

export async function generateStaticParams() {
  const { categories } = await getCatalogPaths();
  // Cache Components needs at least one entry to validate the route; an unknown path renders the 404 page.
  return categories.length > 0 ? categories.map((c) => ({ path: c.path })) : [{ path: ["catalog-empty"] }];
}

async function findService(params: Params) {
  const tree = await getCategoryTree();
  const path = (await params).path;
  const node = findByPath(tree, path);
  if (node) return { tree, node, wallpaperCategory: null };
  // 3D Wallpaper gallery categories: /services/digital-printing/3d-wallpaper/living-room
  const wallpaper = await findWallpaperCategoryPage(tree, path);
  return wallpaper ? { tree, node: wallpaper.service, wallpaperCategory: wallpaper.category } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await findService(params);
  if (!found) return { title: "Page not found", robots: { index: false } };
  const { tree, node, wallpaperCategory } = found;
  if (wallpaperCategory) {
    return seoMetadata({
      title: wallpaperCategory.seoTitle || `${wallpaperCategory.name} 3D Wallpaper Designs in Lahore | Mix Print Design`,
      description: wallpaperCategory.seoDescription || metaDescription(wallpaperCategory.description) || `Browse ${wallpaperCategory.name.toLowerCase()} 3D wallpaper designs, choose one and get your price per sq ft with fitting in Lahore.`,
      path: `${serviceUrl(node.path)}/${wallpaperCategory.slug}`,
    });
  }
  // Pages with rates can have their own SEO title and description.
  const rates = (await getRateIndex()).pages.find((p) => p.categoryId === node.id);
  const image = node.ogImageUrl || node.imageUrl;
  return seoMetadata({
    title: rates?.seoTitle || node.seoTitle || defaultCategoryTitle(node, ancestry(tree, node)),
    description: rates?.seoDescription || node.seoDescription || metaDescription(node.description || node.content),
    path: serviceUrl(node.path),
    images: image ? [{ url: image, alt: node.imageAlt ?? node.name }] : undefined,
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
  return <ServiceDetail tree={found.tree} node={found.node} wallpaperCategory={found.wallpaperCategory} />;
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

async function ServiceDetail({
  tree,
  node,
  wallpaperCategory,
}: {
  tree: CategoryNode[];
  node: CategoryNode;
  /** On a 3D Wallpaper gallery category page (e.g. Living Room): that category. */
  wallpaperCategory: { slug: string; name: string; description: string | null } | null;
}) {
  const chain = ancestry(tree, node);
  const subject = chain.map((c) => c.name).join(" / ");
  // One level at a time: this page lists its direct sub-categories and the products assigned to it,
  // never anything deeper.
  const wallpaper = isWallpaperService(tree, node);
  const [products, rates, hints, gallery, designs] = await Promise.all([
    listProducts({ categoryId: node.id, directOnly: true }),
    getRateContent(node, tree),
    getPriceHints(),
    getCategoryGallery(node.id),
    wallpaper ? getWallpaperGallery() : Promise.resolve(null),
  ]);
  const parent = chain.at(-2);
  const related = siblings(tree, node).slice(0, 6);

  return (
    <>
      <JsonLd data={serviceJsonLd(node, chain)} />
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
          <div>
            <Breadcrumbs items={[{ name: "Services", href: "/services" }, ...chain.map((c) => ({ name: c.name, href: serviceUrl(c.path) }))]} />
            <Link href={parent ? serviceUrl(parent.path) : "/services"} className="mt-2 inline-block text-sm font-semibold text-brand">
              ← Back to {parent ? parent.name : "all services"}
            </Link>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{wallpaperCategory ? `${wallpaperCategory.name} 3D Wallpaper` : rates?.page?.title || node.name}</h1>
            {(wallpaperCategory?.description || node.description) && <p className="mt-3 text-lg text-muted">{wallpaperCategory?.description || node.description}</p>}
            <p className="mt-3">
              {rates && node.priceFromMinor == null ? (
                // Pages with rates: the lowest rate per sq ft set in Admin → Rates
                <span>
                  From <span className="font-bold">{formatRs(rateFromMinor(rates))}</span> <span className="text-muted">per sq ft</span>
                </span>
              ) : (
                <CategoryPrice category={node} hint={hints[node.id]} />
              )}
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
        {gallery.length > 0 && <CategoryGallery images={gallery} name={node.name} />}

        {/* Rates per sq ft with the size calculator: this page's own sections and the ones it shares (e.g. Flex on China Flex) */}
        {rates && <RateSections content={rates} path={serviceUrl(node.path)} />}

        {designs && <WallpaperGallery gallery={designs} basePath={serviceUrl(node.path)} activeSlug={wallpaperCategory?.slug ?? null} />}

        {node.children.length > 0 && (
          <section aria-labelledby="types-heading">
            <h2 id="types-heading" className="text-2xl font-bold">
              {node.name} types
            </h2>
            <div className="app-list mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {node.children.map((c, i) => (
                <CategoryCard key={c.id} category={c} href={serviceUrl(c.path)} index={i + 1} priceHint={hints[c.id]} />
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
                View in Products →
              </Link>
            </div>
            <div className="app-list mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
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
            <div className="app-list mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c, i) => (
                <CategoryCard key={c.id} category={c} href={serviceUrl(c.path)} index={i + 2} priceHint={hints[c.id]} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
