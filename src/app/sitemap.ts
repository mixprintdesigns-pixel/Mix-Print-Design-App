import type { MetadataRoute } from "next";
import { getPublishedPostsForFeeds } from "@/lib/blog/queries";
import { getCatalogPaths } from "@/lib/catalog/queries";
import { categoryUrl, serviceUrl } from "@/lib/catalog/tree";
import { absoluteUrl } from "@/lib/seo";

// Regenerated whenever the catalog changes (the catalog data is cached under the "catalog" tag).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ categories, products }, posts] = await Promise.all([getCatalogPaths(), getPublishedPostsForFeeds()]);
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "daily"),
    page("/products", 0.9, "daily"),
    page("/services", 0.9),
    page("/about", 0.5, "monthly"),
    page("/contact", 0.6, "monthly"),
    page("/affiliate", 0.4, "monthly"),
    ...categories.flatMap((c) => [page(serviceUrl(c.path), c.path.length === 1 ? 0.8 : 0.7), page(categoryUrl(c.path), 0.7, "daily")]),
    ...products.map((p) => ({ ...page(`/products/${p.path.join("/")}`, 0.6), lastModified: p.updatedAt })),
    ...(posts.length ? [page("/blog", 0.6, "daily")] : []),
    ...posts.map((p) => ({ ...page(`/blog/${p.slug}`, 0.5, "monthly"), lastModified: p.updatedAt })),
  ];
}
