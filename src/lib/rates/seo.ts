import { absoluteUrl } from "@/lib/seo";
import { plainText } from "@/lib/blog/content";
import { lowestRate, type PublicRateItem } from "./visibility";

const perSqFt = (minor: number) => ({
  "@type": "UnitPriceSpecification",
  price: minor / 100,
  priceCurrency: "PKR",
  unitCode: "FTK", // square foot (UN/CEFACT)
  unitText: "sq ft",
  referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "FTK" },
});

/** Product + Offer structured data for each rate item, with its price per square foot. */
export function rateItemsJsonLd(items: PublicRateItem[], pagePath: string) {
  const url = absoluteUrl(pagePath);
  return items.map((item) => {
    const rates = item.variants.length > 0 ? item.variants.map((v) => v.rateMinor) : [item.rateMinor];
    const low = lowestRate(item);
    const high = Math.max(...rates);
    const description = item.description ? plainText(item.description).slice(0, 300) : undefined;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: item.subtitle ? `${item.name} (${item.subtitle})` : item.name,
      description,
      image: item.imageUrl ? absoluteUrl(item.imageUrl) : undefined,
      brand: { "@type": "Brand", name: "Mix Print Design" },
      offers:
        rates.length > 1
          ? {
              "@type": "AggregateOffer",
              priceCurrency: "PKR",
              lowPrice: low / 100,
              highPrice: high / 100,
              offerCount: rates.length,
              availability: "https://schema.org/InStock",
              url,
              offers: item.variants.map((v) => ({ "@type": "Offer", name: v.label, priceCurrency: "PKR", price: v.rateMinor / 100, priceSpecification: perSqFt(v.rateMinor), url })),
            }
          : { "@type": "Offer", priceCurrency: "PKR", price: low / 100, priceSpecification: perSqFt(low), availability: "https://schema.org/InStock", url },
    };
  });
}
