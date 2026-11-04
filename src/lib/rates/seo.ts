import { absoluteUrl } from "@/lib/seo";
import { buttonName, type PublicSection } from "./visibility";

const perSqFt = (minor: number) => ({
  "@type": "UnitPriceSpecification",
  price: minor / 100,
  priceCurrency: "PKR",
  unitCode: "FTK", // square foot (UN/CEFACT)
  unitText: "sq ft",
  referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "FTK" },
});

/** Product + Offer structured data for each rate section, one offer per rate button, priced per square foot. */
export function rateSectionsJsonLd(sections: PublicSection[], pagePath: string) {
  const url = absoluteUrl(pagePath);
  return sections.map((section) => {
    const offers = section.groups.flatMap((g) =>
      g.buttons.map((b) => ({ "@type": "Offer", name: buttonName(section, g, b), priceCurrency: "PKR", price: b.rateMinor / 100, priceSpecification: perSqFt(b.rateMinor), url })),
    );
    const prices = offers.map((o) => o.price);
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: section.title.replace(/\s*\(Rs\)\s*$/, ""),
      brand: { "@type": "Brand", name: "Mix Print Design" },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "PKR",
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: offers.length,
        availability: "https://schema.org/InStock",
        url,
        offers,
      },
    };
  });
}
