import Link from "next/link";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryCard } from "@/components/catalog/category-card";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getCategoryTree } from "@/lib/catalog/queries";
import { categoryUrl, serviceUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";

export const generateMetadata = () => pageMetadata("services");

// The same category tree as the Products page: main services → categories → sub-categories → products.
export default async function ServicesPage() {
  const services = await getCategoryTree();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Breadcrumbs items={[{ name: "Services", href: "/services" }]} />
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Our printing &amp; signage services</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Board making, offset printing, digital printing and customized printing in Lahore. Choose a service to see its types and
            products, or ask for a quote on WhatsApp.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Jump to a service">
            {services.map((s) => (
              <a key={s.id} href={`#${s.slug}`} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:border-brand">
                {s.name}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {services.length === 0 && <p className="text-muted">Services will appear here soon.</p>}
        {services.map((service, i) => (
          <section key={service.id} id={service.slug} className="scroll-mt-24" aria-labelledby={`svc-${service.slug}`} data-testid="main-service">
            <div className="grid gap-6 md:grid-cols-[2fr_3fr] md:items-center">
              <Link href={serviceUrl(service.path)} className="block overflow-hidden rounded-xl" tabIndex={-1} aria-hidden>
                <ServiceVisual title={service.name} imageUrl={service.imageUrl} alt={service.imageAlt} index={i} priority={i === 0} sizes="(min-width: 768px) 40vw, 100vw" />
              </Link>
              <div>
                <h2 id={`svc-${service.slug}`} className="text-2xl font-bold">
                  <Link href={serviceUrl(service.path)} className="hover:text-brand">
                    {service.name}
                  </Link>
                </h2>
                {service.description && <p className="mt-2 text-muted">{service.description}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <QuoteButtons subject={service.name} />
                  <Link href={categoryUrl(service.path)} className="text-sm font-semibold text-brand">
                    Shop {service.name} products ({service.productCount}) →
                  </Link>
                </div>
              </div>
            </div>
            {service.children.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {service.children.map((c, ci) => (
                  <CategoryCard key={c.id} category={c} href={serviceUrl(c.path)} index={i + ci + 1} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
