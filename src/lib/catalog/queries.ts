import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const CATALOG_TAG = "catalog";

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
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** Lowest unit price a customer can reach before options, for "from PKR x" labels. */
export function startingUnitPrice(p: Pick<ProductCard, "basePriceMinor" | "priceTiers">): number {
  return Math.min(p.basePriceMinor, ...p.priceTiers.map((t) => t.unitPriceMinor));
}

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  productCount: number; // published products in this category and its subcategories
  children: CategoryNode[];
};

/** Full category tree with published product counts. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      _count: { select: { products: { where: visible } } },
    },
  });
  const nodes = new Map<string, CategoryNode>(
    rows.map(({ _count, ...r }) => [r.id, { ...r, productCount: _count.products, children: [] }]),
  );
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const total = (n: CategoryNode): number => (n.productCount += n.children.reduce((s, c) => s + total(c), 0));
  roots.forEach(total);
  return roots;
}

export function flattenCategories(tree: CategoryNode[], depth = 0): (CategoryNode & { depth: number })[] {
  return tree.flatMap((n) => [{ ...n, depth }, ...flattenCategories(n.children, depth + 1)]);
}

function findCategory(tree: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findCategory(node.children, slug);
    if (found) return found;
  }
}

function descendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
}

export async function getFeaturedProducts(): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return prisma.product.findMany({
    where: { ...visible, isFeatured: true },
    orderBy: { createdAt: "asc" },
    take: 8,
    select: cardSelect,
  });
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
  category?: string;
  q?: string;
  sort?: SortKey;
  /** Only products ready within this many working days. */
  maxDays?: number;
  inStock?: boolean;
};

export function parseProductFilter(params: Record<string, string | string[] | undefined>): ProductFilter {
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const sort = str("sort");
  const maxDays = Number(str("maxDays"));
  return {
    category: str("category"),
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

  let categoryIds: string[] | undefined;
  if (filter.category) {
    const node = findCategory(await getCategoryTree(), filter.category);
    if (!node) return [];
    categoryIds = descendantIds(node);
  }

  const q = filter.q;
  const products = await prisma.product.findMany({
    where: {
      ...visible,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
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
  return products.sort(sorters[filter.sort ?? "featured"]);
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");
  return prisma.product.findFirst({
    where: { slug, ...visible },
    include: {
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
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
