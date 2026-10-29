import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getServiceCategory, type ServiceCategoryDetail } from "@/lib/services/queries";

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = await getServiceCategory((await params).slug);
  return service ? { title: service.title, description: service.shortDescription } : { title: "Service not found" };
}

export default function ServicePage({ params }: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-6xl animate-pulse rounded-xl bg-surface" />}>
      <ServiceDetail params={params} />
    </Suspense>
  );
}

type Products = ServiceCategoryDetail["products"];

function ProductGrid({ products, label }: { products: Products; label: string }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={label} role="list">
      {products.map((p) => (
        <div key={p.id} role="listitem">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

async function ServiceDetail({ params }: { params: PageProps<"/services/[slug]">["params"] }) {
  const service = await getServiceCategory((await params).slug);
  if (!service) notFound();

  const general = service.products.filter((p) => !p.serviceSubtypeId);
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
          <div>
            <nav className="text-sm text-muted" aria-label="Breadcrumb">
              <Link href="/services" className="hover:text-foreground">
                Services
              </Link>{" "}
              / {service.title}
            </nav>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{service.title}</h1>
            <p className="mt-3 text-lg text-muted">{service.shortDescription}</p>
            <div className="mt-5">
              <QuoteButtons subject={service.title} />
            </div>
            {service.subtypes.length > 0 && (
              <nav className="mt-6 flex flex-wrap gap-2" aria-label={`${service.title} types`}>
                {service.subtypes.map((s) => (
                  <a key={s.id} href={`#${s.slug}`} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:border-brand">
                    {s.title}
                  </a>
                ))}
              </nav>
            )}
          </div>
          <div className="overflow-hidden rounded-xl">
            <ServiceVisual title={service.title} imageUrl={service.imageUrl} sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        {service.subtypes.map((subtype, i) => {
          const subtypeOnly = service.products.filter((p) => p.serviceSubtypeId === subtype.id && !p.serviceQualityId);
          return (
            <section key={subtype.id} id={subtype.slug} className="scroll-mt-24" aria-labelledby={`h-${subtype.slug}`} data-testid="service-subtype">
              <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:items-center">
                <div className="overflow-hidden rounded-xl">
                  <ServiceVisual title={subtype.title} imageUrl={subtype.imageUrl} index={i + 1} sizes="(min-width: 768px) 33vw, 100vw" />
                </div>
                <div>
                  <h2 id={`h-${subtype.slug}`} className="text-2xl font-bold">
                    {subtype.title}
                  </h2>
                  <p className="mt-2 text-muted">{subtype.shortDescription}</p>
                  <div className="mt-4">
                    <QuoteButtons subject={`${service.title} / ${subtype.title}`} />
                  </div>
                </div>
              </div>

              {subtype.qualities.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold">Available qualities</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {subtype.qualities.map((quality, qi) => (
                      <article key={quality.id} className="card flex flex-col overflow-hidden" data-testid="service-quality">
                        <ServiceVisual title={quality.title} imageUrl={quality.imageUrl} index={qi + 2} sizes="(min-width: 1024px) 33vw, 100vw" />
                        <div className="flex flex-1 flex-col p-4">
                          <h4 className="font-bold">{quality.title}</h4>
                          <p className="mt-1 flex-1 text-sm text-muted">{quality.shortDescription}</p>
                          <div className="mt-3">
                            <QuoteButtons subject={`${service.title} / ${subtype.title} / ${quality.title}`} compact />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {subtype.qualities.map((quality) => (
                    <ProductGrid
                      key={quality.id}
                      label={`${quality.title} products`}
                      products={service.products.filter((p) => p.serviceQualityId === quality.id)}
                    />
                  ))}
                </div>
              )}
              <ProductGrid label={`${subtype.title} products`} products={subtypeOnly} />
            </section>
          );
        })}

        {general.length > 0 && (
          <section aria-labelledby="service-products">
            <h2 id="service-products" className="text-2xl font-bold">
              {service.title} products
            </h2>
            <ProductGrid label={`${service.title} products`} products={general} />
          </section>
        )}

        <section className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-br from-brand/10 to-accent/10 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Need something custom?</h2>
            <p className="text-muted">Tell us the size, quantity and deadline. We usually reply within working hours.</p>
          </div>
          <QuoteButtons subject={service.title} />
        </section>
      </div>
    </>
  );
}
