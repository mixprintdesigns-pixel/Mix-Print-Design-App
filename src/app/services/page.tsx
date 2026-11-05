import Link from "next/link";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryPrice } from "@/components/catalog/category-price";
import { AppCardActions } from "@/components/app/app-card-actions";
import { APP_ROW_CARD, APP_ROW_VISUAL } from "@/components/catalog/category-card";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getPriceHints } from "@/lib/rates/queries";
import { serviceUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";

export const generateMetadata = () => pageMetadata("services");

// One level at a time: this page lists only the main services (in the original Services page design).
// Each service page lists its own categories, each category its sub-categories, and the last level its products.
export default async function ServicesPage() {
  const [services, hints] = await Promise.all([getCategoryTree(), getPriceHints()]);
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

      <div className="app-grid mx-auto max-w-6xl space-y-10 px-4 py-12 app:py-6" data-testid="main-services">
        {services.length === 0 && <p className="text-muted">Services will appear here soon.</p>}
        {services.map((service, i) => (
          <section
            key={service.id}
            className={`card grid overflow-hidden md:grid-cols-[2fr_3fr] ${APP_ROW_CARD}`}
            aria-labelledby={`svc-${service.slug}`}
            data-testid="category-card"
          >
            <Link href={serviceUrl(service.path)} className="app-tile-media block" tabIndex={-1} aria-hidden>
              <ServiceVisual
                title={service.name}
                imageUrl={service.imageUrl}
                alt={service.imageAlt}
                index={i}
                priority={i === 0}
                sizes="(min-width: 768px) 40vw, (display-mode: standalone) 50vw, 100vw"
                className={APP_ROW_VISUAL}
                initialsClassName="app:hidden"
              />
            </Link>
            <div className="app-tile-body flex flex-col p-6">
              <h2 id={`svc-${service.slug}`} className="app-card-title text-2xl font-bold">
                <Link href={serviceUrl(service.path)} className="app-tile-link hover:text-brand">
                  {service.name}
                </Link>
              </h2>
              {service.description && <p className="app-card-text app-tile-hide mt-2 text-muted">{service.description}</p>}
              <p className="app-tile-price mt-3 text-sm">
                <CategoryPrice category={service} hint={hints[service.id]} />
              </p>
              {/* The installed app shows one action row instead (below) */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5 app:hidden!">
                <Link href={serviceUrl(service.path)} className="font-semibold text-brand">
                  View {service.name} →
                </Link>
                <QuoteButtons subject={service.name} />
              </div>
            </div>
            <AppCardActions
              href={serviceUrl(service.path)}
              subject={service.name}
              priceOnRequest={!hints[service.id] && service.priceFromMinor == null}
            />
          </section>
        ))}
      </div>
    </>
  );
}
