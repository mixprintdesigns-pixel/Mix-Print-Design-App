import Link from "next/link";
import type { ServiceTree } from "@/lib/services/queries";
import { QuoteButtons } from "./quote-buttons";
import { ServiceVisual } from "./service-visual";

export function ServiceCard({ service, index }: { service: ServiceTree[number]; index: number }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" data-testid="service-card">
      <Link href={`/services/${service.slug}`} className="block">
        <ServiceVisual title={service.title} imageUrl={service.imageUrl} index={index} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold">
          <Link href={`/services/${service.slug}`} className="hover:text-brand">
            {service.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{service.shortDescription}</p>
        {service.subtypes.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${service.title} types`}>
            {service.subtypes.map((s) => (
              <li key={s.id}>
                <Link href={`/services/${service.slug}#${s.slug}`} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <Link href={`/services/${service.slug}`} className="text-sm font-semibold text-brand">
            Explore {service._count.products > 0 ? `${service._count.products} products` : "service"} →
          </Link>
          <QuoteButtons subject={service.title} compact />
        </div>
      </div>
    </article>
  );
}
