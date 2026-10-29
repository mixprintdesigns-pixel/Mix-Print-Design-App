import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";

export const SERVICES_TAG = "services";

const productCard = {
  where: { status: "PUBLISHED" as const },
  orderBy: { name: "asc" as const },
  select: {
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
    serviceSubtypeId: true,
    serviceQualityId: true,
    images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } },
    priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
  },
};

const level = { id: true, slug: true, title: true, shortDescription: true, imageUrl: true } as const;

/** Visible service categories with their visible sub-types and qualities, for the Services and Home pages. */
export async function getServiceTree() {
  "use cache";
  cacheTag(SERVICES_TAG, "catalog");
  cacheLife("hours");
  return prisma.serviceCategory.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      ...level,
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      subtypes: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: { ...level, qualities: { where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: level } },
      },
    },
  });
}
export type ServiceTree = Awaited<ReturnType<typeof getServiceTree>>;

/** One visible category with its levels and every published product linked to it. */
export async function getServiceCategory(slug: string) {
  "use cache";
  cacheTag(SERVICES_TAG, "catalog");
  cacheLife("hours");
  return prisma.serviceCategory.findFirst({
    where: { slug, isVisible: true },
    select: {
      ...level,
      products: productCard,
      subtypes: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: {
          ...level,
          qualities: { where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: level },
        },
      },
    },
  });
}
export type ServiceCategoryDetail = NonNullable<Awaited<ReturnType<typeof getServiceCategory>>>;
