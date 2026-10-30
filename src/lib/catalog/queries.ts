import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { buildTree, descendantIds, findById, findByPath, flatten, productUrl, type CategoryNode, type CategoryRow } from "./tree";

export const CATALOG_TAG = "catalog";
export type { CategoryNode };

/** Only published products are ever shown to customers. */
const visible = { status: "PUBLISHED" } as const satisfies Prisma.ProductWhereInput;

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  summary: true,
  basePriceMinor: true,
  minQuantity: true,
  turnaroundDays: true,
  isAvailable: true,
  isFeatured: true,
  createdAt: true,
  categoryId: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
  affiliateCommissionMinor: true,
  affiliateCommissionBps: true,
} satisfies Prisma.ProductSelect;

/** A product as shown on cards, with its canonical URL (/products/<category path>/<product slug>). */
export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }> & { href: string };

/** Lowest unit price a customer can reach before options, for "from PKR x" labels. */
export function startingUnitPrice(p: Pick<ProductCard, "basePriceMinor" | "priceTiers">): number {
  return Math.min(p.basePriceMinor, ...p.priceTiers.map((t) => t.unitPriceMinor));
}

async function loadRows(): Promise<CategoryRow[]> {
  const rows = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      content: true,
      imageUrl: true,
      imageAlt: true,
      sortOrder: true,
      isVisible: true,
      priceFromMinor: true,
      priceUnit: true,
      seoTitle: true,
      seoDescription: true,
      parentId: true,
      _count: { select: { products: { where: visible } } },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, directProductCount: _count.products }));
}

/** Uncached read of the visible tree, for code that runs outside page rendering (e.g. the AI assistant's index). */
export async function readCategoryTree(): Promise<CategoryNode[]> {
  return buildTree(await loadRows());
}

/** The visible category tree (main services at the top), shared by the Services and Products pages. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return readCategoryTree();
}

function withHrefs<T extends { slug: string; categoryId: string }>(products: T[], tree: CategoryNode[]): (T & { href: string })[] {
  return products.map((p) => {
    const category = findById(tree, p.categoryId);
    return { ...p, href: category ? productUrl(category.path, p.slug) : `/products/${p.slug}` };
  });
}

/** Only products whose category is visible appear on the website. */
function inVisibleCategories(tree: CategoryNode[]) {
  return { categoryId: { in: flatten(tree).map((c) => c.id) } } satisfies Prisma.ProductWhereInput;
}

export async function getFeaturedProducts(): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const tree = await getCategoryTree();
  const products = await prisma.product.findMany({
    where: { ...visible, ...inVisibleCategories(tree), isFeatured: true },
    orderBy: { createdAt: "asc" },
    take: 8,
    select: cardSelect,
  });
  return withHrefs(products, tree);
}

export const SORTS = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
  name: "Name A–Z",
  fastest: "Fastest production",
} as const;
export type SortKey = keyof typeof SORTS;

export type ProductFilter = {
  /** Category id; products in all its sub-categories are included unless `directOnly` is set. */
  categoryId?: string;
  /** Only products assigned to the category itself (the Services pages show one level at a time). */
  directOnly?: boolean;
  q?: string;
  sort?: SortKey;
  /** Only products ready within this many working days. */
  maxDays?: number;
  inStock?: boolean;
};

export function parseProductFilter(params: Record<string, string | string[] | undefined>): Omit<ProductFilter, "categoryId"> {
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const sort = str("sort");
  const maxDays = Number(str("maxDays"));
  return {
    q: str("q")?.trim().slice(0, 100) || undefined,
    sort: sort && sort in SORTS ? (sort as SortKey) : "featured",
    maxDays: Number.isInteger(maxDays) && maxDays > 0 && maxDays <= 60 ? maxDays : undefined,
    inStock: str("inStock") === "1",
  };
}

export async function listProducts(filter: ProductFilter): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const tree = await getCategoryTree();
  let categoryIds = flatten(tree).map((c) => c.id);
  if (filter.categoryId) {
    const node = findById(tree, filter.categoryId);
    if (!node) return [];
    categoryIds = filter.directOnly ? [node.id] : descendantIds(node);
  }

  const q = filter.q;
  const products = await prisma.product.findMany({
    where: {
      ...visible,
      categoryId: { in: categoryIds },
      ...(filter.inStock ? { isAvailable: true } : {}),
      ...(filter.maxDays ? { turnaroundDays: { lte: filter.maxDays } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { sku: { equals: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: cardSelect,
  });

  const byName = (a: ProductCard, b: ProductCard) => a.name.localeCompare(b.name);
  const sorters: Record<SortKey, (a: ProductCard, b: ProductCard) => number> = {
    featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || byName(a, b),
    "price-asc": (a, b) => startingUnitPrice(a) - startingUnitPrice(b) || byName(a, b),
    "price-desc": (a, b) => startingUnitPrice(b) - startingUnitPrice(a) || byName(a, b),
    newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    name: byName,
    fastest: (a, b) => a.turnaroundDays - b.turnaroundDays || byName(a, b),
  };
  return withHrefs(products, tree).sort(sorters[filter.sort ?? "featured"]);
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");
  return prisma.product.findFirst({
    where: { slug, ...visible },
    include: {
      category: { select: { id: true, name: true, slug: true, isVisible: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
      priceTiers: { orderBy: { minQuantity: "asc" }, select: { minQuantity: true, unitPriceMinor: true } },
      bulkDiscounts: { orderBy: { minQuantity: "asc" }, select: { minQuantity: true, percentBps: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          kind: true,
          values: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, label: true, priceDeltaMinor: true, pricing: true },
          },
        },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export type ResolvedPath =
  | { kind: "category"; node: CategoryNode }
  | { kind: "product"; product: ProductDetail; category: CategoryNode; canonical: string };

/**
 * Resolves /products/<…segments>: a category path, or a category path followed by a product slug.
 * Old single-segment product links (/products/<slug>) still resolve, with the canonical URL attached.
 */
export async function resolveCatalogPath(segments: string[]): Promise<ResolvedPath | null> {
  const tree = await getCategoryTree();
  const node = findByPath(tree, segments);
  if (node) return { kind: "category", node };

  const product = await getProductBySlug(segments.at(-1) ?? "");
  const category = product ? findById(tree, product.categoryId) : null;
  if (!product || !category) return null;
  return { kind: "product", product, category, canonical: productUrl(category.path, product.slug) };
}

/** Every public category path and product path, for static generation and the sitemap. */
export async function getCatalogPaths() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const tree = await getCategoryTree();
  const products = await prisma.product.findMany({
    where: { ...visible, ...inVisibleCategories(tree) },
    select: { slug: true, categoryId: true, updatedAt: true },
  });
  return {
    categories: flatten(tree).map((c) => ({ path: c.path })),
    products: products.flatMap((p) => {
      const category = findById(tree, p.categoryId);
      return category ? [{ path: [...category.path, p.slug], updatedAt: p.updatedAt }] : [];
    }),
  };
}

/** Other published products in the same category (then its parent), for "related products". */
export async function getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const tree = await getCategoryTree();
  const category = findById(tree, categoryId);
  if (!category) return [];
  const parent = category.path.length > 1 ? findByPath(tree, category.path.slice(0, -1)) : null;
  const scope = descendantIds(parent ?? category);
  const products = await prisma.product.findMany({
    where: { ...visible, id: { not: productId }, categoryId: { in: scope } },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    take: 12,
    select: cardSelect,
  });
  // Same category first, then the rest of the parent's tree.
  const sorted = [...products.filter((p) => p.categoryId === categoryId), ...products.filter((p) => p.categoryId !== categoryId)];
  return withHrefs(sorted.slice(0, limit), tree);
}
