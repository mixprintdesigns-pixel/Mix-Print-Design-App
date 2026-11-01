import "server-only";
import { prisma } from "@/lib/db";
import { getCategoryTree } from "@/lib/catalog/queries";
import { categoryUrl, findById, flatten, productUrl, serviceUrl } from "@/lib/catalog/tree";
import { readSiteSettings, whatsappUrl } from "@/lib/content/site-settings";
import type { LinkTarget } from "@/components/admin/blog/article-editor";

/** Pages the blog editor's link picker offers: products, services, categories, articles, contact and WhatsApp. */
export async function blogLinkTargets(): Promise<LinkTarget[]> {
  const [tree, products, posts, settings] = await Promise.all([
    getCategoryTree(),
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { name: "asc" },
      select: { name: true, slug: true, categoryId: true },
    }),
    prisma.blogPost.findMany({
      where: { status: { in: ["PUBLISHED", "SCHEDULED"] } },
      orderBy: { updatedAt: "desc" },
      select: { title: true, slug: true },
    }),
    readSiteSettings(),
  ]);
  const nodes = flatten(tree);
  const crumbs = (path: string[]) =>
    path.map((_, i) => nodes.find((n) => n.path.length === i + 1 && n.path.every((p, k) => p === path[k]))?.name ?? path[i]).join(" › ");
  return [
    { group: "Contact", label: "Contact Us page", href: "/contact" },
    {
      group: "Contact",
      label: "Chat on WhatsApp",
      href: whatsappUrl(settings),
    },
    {
      group: "Contact",
      label: "Call us",
      href: `tel:+${settings.whatsappNumber}`,
    },
    ...products.flatMap((p) => {
      const category = findById(tree, p.categoryId);
      return category
        ? [
            {
              group: "Products",
              label: p.name,
              href: productUrl(category.path, p.slug),
            },
          ]
        : [];
    }),
    ...nodes.map((n) => ({
      group: "Services",
      label: crumbs(n.path),
      href: serviceUrl(n.path),
    })),
    ...nodes.map((n) => ({
      group: "Product categories",
      label: crumbs(n.path),
      href: categoryUrl(n.path),
    })),
    ...posts.map((p) => ({
      group: "Blog articles",
      label: p.title,
      href: `/blog/${p.slug}`,
    })),
    { group: "Pages", label: "All products", href: "/products" },
    { group: "Pages", label: "All services", href: "/services" },
    { group: "Pages", label: "Blog", href: "/blog" },
  ];
}
