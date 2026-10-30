import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ProductCard } from "@/components/product-card";
import { ReviewCard } from "@/components/reviews/review-card";
import { CategoryCard } from "@/components/catalog/category-card";
import { JsonLd } from "@/components/catalog/json-ld";
import { QuoteButtons } from "@/components/services/quote-buttons";
import { quoteLink } from "@/lib/business";
import { getCategoryTree, getFeaturedProducts } from "@/lib/catalog/queries";
import { categoryUrl, serviceUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";
import { getPublishedReviews } from "@/lib/reviews/queries";
import { localBusinessJsonLd } from "@/lib/seo";
import { getPublicProgramTerms } from "@/lib/affiliate/public";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";

export const generateMetadata = () => pageMetadata("home");

/** Customer reviews as structured data on the business (shown in search results as star ratings). */
function reviewsJsonLd(reviews: Awaited<ReturnType<typeof getPublishedReviews>>) {
  if (reviews.length === 0) return null;
  return localBusinessJsonLd({
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1),
      reviewCount: reviews.length,
      bestRating: 5,
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.comment,
    })),
  });
}

// Catalog data is cached ("use cache"), so this whole page prerenders into the static shell.
export default async function HomePage() {
  const [services, featured, affiliate, reviews] = await Promise.all([
    getCategoryTree(),
    getFeaturedProducts(),
    getPublicProgramTerms(),
    getPublishedReviews(),
  ]);
  const reviewData = reviewsJsonLd(reviews);

  return (
    <>
      {reviewData && <JsonLd data={reviewData} />}
      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.15fr_1fr] md:items-center md:py-20">
          <div>
            <BrandLogo className="h-14 w-auto sm:h-16" priority />
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Print that makes your brand <span className="text-brand">stand out.</span>
            </h1>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Business cards, flyers, sign boards, banners and packaging from Lahore, delivered across Pakistan. Upload your
              artwork or let our designers create it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary px-6 py-3 text-base">
                Shop Now
              </Link>
              <Link href={quoteLink()} className="btn-secondary px-6 py-3 text-base">
                Get a Quote
              </Link>
            </div>
          </div>
          <ol className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["1", "Choose & configure", "Size, paper, finish and quantity with live pricing."],
              ["2", "Upload or request design", "Send your file or brief our design team."],
              ["3", "Approve your proof", "Nothing is printed until you approve it."],
              ["4", "Track delivery", "Follow your order from press to doorstep."],
            ].map(([n, title, text]) => (
              <li key={n} className="card p-4">
                <span className="text-2xl font-black text-brand">{n}</span>
                <p className="mt-1 font-semibold">{title}</p>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 2. Top products */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="top-products-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="top-products-heading" className="text-2xl font-bold">
              Top products
            </h2>
            <Link href="/products" className="text-sm font-semibold text-brand">
              View all products →
            </Link>
          </div>
          {/* Swipeable row on phones, grid on larger screens */}
          <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {featured.map((p) => (
              <div key={p.id} className="w-72 shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Services: the main services from the shared category tree */}
      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="services-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">What we do</p>
              <h2 id="services-heading" className="text-2xl font-bold">
                Our services
              </h2>
            </div>
            <Link href="/services" className="text-sm font-semibold text-brand">
              All services →
            </Link>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <div key={s.id} className="flex flex-col gap-2">
                <CategoryCard category={s} href={serviceUrl(s.path)} index={i} />
                <QuoteButtons subject={s.name} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Customer reviews (managed in Admin → Reviews; hidden until there are published reviews) */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="reviews-heading">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Testimonials</p>
          <h2 id="reviews-heading" className="text-2xl font-bold">
            What our customers say
          </h2>
          <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {reviews.map((r) => (
              <div key={r.id} className="w-80 shrink-0 snap-start md:w-auto">
                <ReviewCard review={r} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-2xl font-bold">
          Shop by category
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.id}>
              <h3 className="font-semibold">
                <Link href={categoryUrl(s.path)} className="hover:text-brand">
                  {s.name}
                </Link>
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {s.children.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href={categoryUrl(c.path)} className="text-muted hover:text-brand">
                      {c.name}
                    </Link>
                  </li>
                ))}
                {s.children.length > 8 && (
                  <li>
                    <Link href={categoryUrl(s.path)} className="font-semibold text-brand">
                      All {s.children.length} categories →
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="affiliate-heading">
        <div className="card grid gap-6 overflow-hidden bg-gradient-to-br from-brand/10 via-surface to-accent/10 p-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Affiliate program</p>
            <h2 id="affiliate-heading" className="mt-2 text-3xl font-extrabold tracking-tight">
              Share Mix Print Design. Earn <span className="text-brand">{formatPercent(affiliate.defaultRateBps)}</span> on every order.
            </h2>
            <p className="mt-3 text-muted">
              Designers, influencers and community admins earn commission when people they refer order printing from Mix Print Design.
              Paid out to JazzCash, Easypaisa or your bank.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/affiliate/join" className="btn-primary">
                Become an affiliate
              </Link>
              <Link href="/affiliate" className="btn-secondary">
                How it works
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              [formatPercent(affiliate.defaultRateBps), "commission on product value"],
              [`${affiliate.cookieDays} days`, "referral window"],
              [formatPKR(affiliate.minWithdrawalMinor), "minimum payout"],
              ["3 ways", "JazzCash, Easypaisa, bank"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg bg-surface/80 p-4">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block text-2xl font-black text-brand">{value}</span>
                  <span className="text-muted">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
