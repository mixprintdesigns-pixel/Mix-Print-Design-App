import type { Metadata } from "next";
import Link from "next/link";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { ServiceVisual } from "@/components/services/service-visual";
import { getServiceTree } from "@/lib/services/queries";

export const metadata: Metadata = {
  title: "Services: Board Maker, Offset & Digital Printing",
  description: "Sign boards (backlit, front-lit, 3D), offset printing and digital printing in Lahore by Mix Print Design.",
};

export default async function ServicesPage() {
  const services = await getServiceTree();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Services</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Everything you need, printed right.</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Choose a service to see the types, qualities and products we offer, or ask for a quote on WhatsApp.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
        {services.length === 0 && <p className="text-muted">Services will appear here soon.</p>}
        {services.map((service, i) => (
          <section key={service.id} className="card grid overflow-hidden md:grid-cols-[2fr_3fr]" aria-labelledby={`svc-${service.slug}`}>
            <Link href={`/services/${service.slug}`} className="block">
              <ServiceVisual title={service.title} imageUrl={service.imageUrl} index={i} sizes="(min-width: 768px) 40vw, 100vw" />
            </Link>
            <div className="flex flex-col p-6">
              <h2 id={`svc-${service.slug}`} className="text-2xl font-bold">
                <Link href={`/services/${service.slug}`} className="hover:text-brand">
                  {service.title}
                </Link>
              </h2>
              <p className="mt-2 text-muted">{service.shortDescription}</p>
              {service.subtypes.length > 0 && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {service.subtypes.map((s) => (
                    <li key={s.id}>
                      <Link href={`/services/${service.slug}#${s.slug}`} className="block rounded-lg border border-border p-3 hover:border-brand">
                        <span className="font-semibold">{s.title}</span>
                        {s.qualities.length > 0 && (
                          <span className="block text-xs text-muted">{s.qualities.map((q) => q.title).join(" · ")}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                <Link href={`/services/${service.slug}`} className="font-semibold text-brand">
                  View {service.title} →
                </Link>
                <QuoteButtons subject={service.title} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
