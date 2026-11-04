import Image from "next/image";
import { ArticleBody } from "@/components/blog/article-body";
import { JsonLd } from "@/components/catalog/json-ld";
import { parseBlocks } from "@/lib/blog/content";
import type { PublicRatePage } from "@/lib/rates/queries";
import { rateSectionsJsonLd } from "@/lib/rates/seo";
import type { PublicSection } from "@/lib/rates/visibility";
import { RateBar } from "./rate-calculator";
import { FlexSection, SignBoardQuality, StickerSection } from "./rate-section-views";

// The rate sections of a service page (Admin → Rates): a blue title bar, rate buttons and the calculator.

export function RateSections({ page, path }: { page: PublicRatePage; path: string }) {
  return (
    <div aria-label="Rates and price calculator" role="region" className="space-y-12" data-testid="rate-sections">
      <JsonLd data={rateSectionsJsonLd(page.sections, path)} />
      {page.intro && <p className="max-w-3xl text-lg text-muted">{page.intro}</p>}
      {page.sections.map((section) =>
        section.kind === "FLEX" ? (
          <FlexSection key={section.id} section={section} settings={page.settings} />
        ) : section.kind === "STICKER" ? (
          <StickerSection key={section.id} section={section} settings={page.settings} />
        ) : (
          <SignBoardSection key={section.id} section={section} page={page} />
        ),
      )}
    </div>
  );
}

/** Sign boards: the title bar, then one card per quality with its rate, features checklist, description and calculator. */
function SignBoardSection({ section, page }: { section: PublicSection; page: PublicRatePage }) {
  return (
    <section aria-labelledby={`sec-${section.id}`} className="space-y-4" data-testid="rate-section">
      <RateBar id={`sec-${section.id}`}>{section.title}</RateBar>
      <div className="app-list grid gap-5">
        {section.groups.map((group) => (
          <article key={group.id} className="card p-4 sm:p-6" aria-labelledby={`q-${group.id}`} data-testid="rate-quality">
            <h3 id={`q-${group.id}`} className="text-xl font-bold">
              {group.name}
            </h3>
            <div className="mt-3">
              <SignBoardQuality section={section} groupId={group.id} settings={page.settings}>
                <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  {group.features.length > 0 && (
                    <ul className="space-y-1.5" aria-label={`What ${group.name} includes`}>
                      {group.features.map((f) => (
                        <li key={f.label} className={`flex items-center gap-2 ${f.included ? "font-medium" : "text-muted/60 line-through decoration-transparent"}`}>
                          <span
                            aria-hidden
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-black ${f.included ? "bg-green-600 text-white" : "bg-border text-muted/60"}`}
                          >
                            {f.included ? "✓" : "–"}
                          </span>
                          {f.label}
                          <span className="sr-only">{f.included ? " (included)" : " (not included)"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="min-w-0">
                    {group.imageUrl && (
                      <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-lg bg-background">
                        <Image src={group.imageUrl} alt={group.imageAlt || group.name} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" unoptimized={group.imageUrl.endsWith(".svg")} />
                      </div>
                    )}
                    {group.description && <ArticleBody blocks={parseBlocks(group.description)} />}
                  </div>
                </div>
              </SignBoardQuality>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
