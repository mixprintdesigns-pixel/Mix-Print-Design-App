import Image from "next/image";
import { ArticleBody } from "@/components/blog/article-body";
import { JsonLd } from "@/components/catalog/json-ld";
import { parseBlocks } from "@/lib/blog/content";
import { formatRs } from "@/lib/rates/calculator";
import type { PublicRatePage } from "@/lib/rates/queries";
import { rateItemsJsonLd } from "@/lib/rates/seo";
import { groupBySection, lowestRate, type PublicRateItem } from "@/lib/rates/visibility";
import { RateCalculator } from "./rate-calculator";

// The rate items of a service page (Admin → Rates): each with its name, sub-title, description, rate per sq ft
// and the size calculator. Only items with a rate are passed in.

export function RateSection({ page, path }: { page: PublicRatePage; path: string }) {
  const groups = groupBySection(page.items);
  return (
    <section aria-label="Rates and price calculator" className="space-y-10" data-testid="rate-section">
      <JsonLd data={rateItemsJsonLd(page.items, path)} />
      {page.intro && <p className="max-w-3xl text-lg text-muted">{page.intro}</p>}
      {groups.map((group) => (
        <div key={group.section || "items"} className="space-y-6">
          {group.section && (
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">{group.section}</p>
              <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="app-list grid gap-6">
            {group.items.map((item) => (
              <RateItemBlock key={item.id} item={item} page={page} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RateItemBlock({ item, page }: { item: PublicRateItem; page: PublicRatePage }) {
  const hasVariants = item.variants.length > 0;
  return (
    <article className="card grid gap-6 overflow-hidden p-5 sm:p-6 lg:grid-cols-[1fr_1.05fr]" data-testid="rate-item" aria-labelledby={`rate-${item.id}`}>
      <div className="min-w-0">
        {item.imageUrl && (
          <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-lg bg-background">
            <Image src={item.imageUrl} alt={item.imageAlt || item.name} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" unoptimized={item.imageUrl.endsWith(".svg")} />
          </div>
        )}
        {item.subtitle && <p className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">{item.subtitle}</p>}
        <h2 id={`rate-${item.id}`} className="mt-2 text-2xl font-bold">
          {item.name}
        </h2>
        <p className="mt-1 text-base">
          {hasVariants && item.variants.length > 1 ? "From " : ""}
          <span className="font-bold text-brand">{formatRs(lowestRate(item))}</span> <span className="text-muted">per sq ft</span>
        </p>
        {item.description && (
          <div className="mt-4">
            <ArticleBody blocks={parseBlocks(item.description)} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <RateCalculator
          item={{ id: item.id, name: item.name, variantType: item.variantType, rateMinor: item.rateMinor, variants: item.variants }}
          designChargeMinor={page.settings.designChargeMinor}
          minOrderMinor={page.settings.minOrderMinor}
        />
      </div>
    </article>
  );
}
