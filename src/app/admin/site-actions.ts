"use server";

// Admin actions for the website pages added in this stage: reviews, services, About page, contact messages.
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { REVIEWS_TAG } from "@/lib/reviews/queries";
import { deleteReview, moveReview, reviewSchema, saveReview } from "@/lib/reviews/admin";
import type { ActionState } from "./affiliate-actions";

const id = z.string().min(1).max(50);

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please check the form.";
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function saveReviewAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  const parsed = reviewSchema.safeParse({
    name: data.get("name"),
    location: data.get("location") ?? "",
    rating: data.get("rating"),
    comment: data.get("comment"),
    isPublished: data.get("isPublished") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const reviewId = data.get("id") ? id.parse(data.get("id")) : null;
  await saveReview(reviewId, parsed.data);
  updateTag(REVIEWS_TAG);
  refresh();
  return { message: reviewId ? "Review updated." : "Review added." };
}

export async function reviewCommandAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  const reviewId = id.parse(data.get("id"));
  const command = z.enum(["up", "down", "delete"]).parse(data.get("command"));
  if (command === "delete") await deleteReview(reviewId);
  else await moveReview(reviewId, command);
  updateTag(REVIEWS_TAG);
  refresh();
  return { message: command === "delete" ? "Review deleted." : "Order saved." };
}
