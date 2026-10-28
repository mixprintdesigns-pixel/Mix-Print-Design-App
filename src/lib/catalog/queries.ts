import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const CATALOG_TAG = "catalog";

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  summary: true,
  basePriceMinor: true,
  minQuantity: true,
  turnaroundDays: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** Lowest unit price a customer can reach, for "from PKR x" labels. */
export function startingUnitPrice(p: Pick<ProductCard, "basePriceMinor" | "priceTiers">): number {
  return Math.min(p.basePriceMinor, ...p.priceTiers.map((t) => t.unitPriceMinor));
}

export async function getCategories() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
  });
}

export async function getFeaturedProducts(): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { createdAt: "asc" },
    take: 8,
    select: cardSelect,
  });
}

export async function listProducts(filter: { category?: string; q?: string }): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const q = filter.q?.trim().slice(0, 100);
  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(filter.category ? { category: { slug: filter.category } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    select: cardSelect,
  });
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
      priceTiers: { orderBy: { minQuantity: "asc" }, select: { minQuantity: true, unitPriceMinor: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          values: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, priceDeltaMinor: true } },
        },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
