// Shared SEO helpers: the site's public URL, JSON-LD (structured data) builders and page metadata defaults.
import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";

/**
 * The public site URL used for canonical links, the sitemap and structured data.
 * Set APP_URL to the live domain (e.g. https://mixprintdesign.com); on Vercel the production domain is used as a fallback.
 */
export const SITE_URL = (
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = BUSINESS.name;

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

type JsonLdObject = Record<string, unknown>;

/** Serialises structured data safely for a <script type="application/ld+json"> tag. */
export function jsonLdString(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function localBusinessJsonLd(extra: JsonLdObject = {}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: BUSINESS.name,
    url: SITE_URL,
    logo: absoluteUrl("/brand/mix-print-design-icon.png"),
    image: absoluteUrl("/og-image.png"),
    email: BUSINESS.email,
    telephone: BUSINESS.phoneTel,
    priceRange: "PKR",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Raiwind Road",
      addressLocality: "Lahore",
      addressRegion: "Punjab",
      addressCountry: "PK",
    },
    areaServed: { "@type": "Country", name: "Pakistan" },
    sameAs: [BUSINESS.facebookUrl],
    ...extra,
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

/** Open Graph fields every page shares; page metadata spreads these because Open Graph is not merged with the layout's. */
const DEFAULT_OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: `${SITE_NAME}, printing and sign boards in Lahore` };

export const OPEN_GRAPH_DEFAULTS = {
  siteName: SITE_NAME,
  locale: "en_PK",
  type: "website",
  images: [DEFAULT_OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;

/** Title, description, canonical URL and social tags for a page. `title` is used exactly as given. */
export function seoMetadata({
  title,
  description,
  path,
  images,
  noIndex = false,
}: {
  title: string;
  description?: string;
  path: string;
  images?: { url: string; alt?: string }[];
  noIndex?: boolean;
}): Metadata {
  const ogImages = images?.length ? images.map((i) => ({ ...i, url: absoluteUrl(i.url) })) : [DEFAULT_OG_IMAGE];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH_DEFAULTS, title, description, url: path, images: ogImages },
    twitter: { card: "summary_large_image", title, description, images: ogImages.map((i) => i.url) },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
