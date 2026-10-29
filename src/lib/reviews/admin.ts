import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const reviewSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name.").max(80),
  location: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  rating: z.coerce.number().int().min(1, "Rating is 1–5 stars.").max(5, "Rating is 1–5 stars."),
  comment: z.string().trim().min(5, "Enter the review text.").max(600),
  isPublished: z.boolean(),
});
export type ReviewData = z.infer<typeof reviewSchema>;

export async function saveReview(id: string | null, data: ReviewData) {
  if (id) return prisma.review.update({ where: { id }, data });
  const last = await prisma.review.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return prisma.review.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
}

export async function deleteReview(id: string) {
  await prisma.review.deleteMany({ where: { id } });
}

/** Swaps a review with its neighbour in the display order. */
export async function moveReview(id: string, direction: "up" | "down") {
  const all = await prisma.review.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
  const i = all.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((r, sortOrder) => prisma.review.update({ where: { id: r.id }, data: { sortOrder } })));
}

export async function listReviewsForAdmin() {
  return prisma.review.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
}
