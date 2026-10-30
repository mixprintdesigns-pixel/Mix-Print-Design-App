import Link from "next/link";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryPrice } from "@/components/catalog/category-price";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getCategoryTree } from "@/lib/catalog/queries";
import { serviceUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";

export const generateMetadata = () => pageMetadata("services");

// One level at a time: this page lists only the main services (in the original Services page design).
// Each service page lists its own categories, each category its sub-categories, and the last level its products.
export default async function ServicesPage() {
  const services = await getCategoryTree();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Breadcrumbs items={[{ name: "Services", href: "/services" }]} />
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-accent">Services</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Everything you need, printed right.</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Choose a service to see its types and products, or order directly on WhatsApp.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12" data-testid="main-services">
        {services.length === 0 && <p className="text-muted">Services will appear here soon.</p>}
        {services.map((service, i) => (
          <section
            key={service.id}
            className="card grid overflow-hidden md:grid-cols-[2fr_3fr]"
            aria-labelledby={`svc-${service.slug}`}
            data-testid="category-card"
          >
            <Link href={serviceUrl(service.path)} className="block" tabIndex={-1} aria-hidden>
              <ServiceVisual
                title={service.name}
                imageUrl={service.imageUrl}
                alt={service.imageAlt}
                index={i}
                priority={i === 0}
                sizes="(min-width: 768px) 40vw, 100vw"
              />
            </Link>
            <div className="flex flex-col p-6">
              <h2 id={`svc-${service.slug}`} className="text-2xl font-bold">
                <Link href={serviceUrl(service.path)} className="hover:text-brand">
                  {service.name}
                </Link>
              </h2>
              {service.description && <p className="mt-2 text-muted">{service.description}</p>}
              <p className="mt-3 text-sm">
                <CategoryPrice category={service} />
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                <Link href={serviceUrl(service.path)} className="font-semibold text-brand">
                  View {service.name} →
                </Link>
                <QuoteButtons subject={service.name} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
