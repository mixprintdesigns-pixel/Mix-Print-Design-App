import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";

export const REVIEWS_TAG = "reviews";

export async function getPublishedReviews(take = 12) {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("hours");
  return prisma.review.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take,
    select: { id: true, name: true, location: true, rating: true, comment: true },
  });
}
