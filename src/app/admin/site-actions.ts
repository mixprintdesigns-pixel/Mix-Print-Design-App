"use server";

// Admin actions for the website pages added in this stage: reviews, services, About page, contact messages.
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { REVIEWS_TAG } from "@/lib/reviews/queries";
import { deleteReview, moveReview, reviewSchema, saveReview } from "@/lib/reviews/admin";
import type { ActionState } from "./affiliate-actions";
import { SERVICES_TAG } from "@/lib/services/queries";
import {
  deleteLevel,
  levelSchema,
  linkProduct,
  moveLevel,
  removeLevelImage,
  ServiceAdminError,
  saveLevel,
  setLevelImage,
  unlinkProduct,
  type ServiceLevel,
} from "@/lib/services/admin";


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

// ─── Services ────────────────────────────────────────────────────────────────

const levelKind = z.enum(["category", "subtype", "quality"]);

async function servicesChange(fn: () => Promise<string>): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  try {
    const message = await fn();
    updateTag(SERVICES_TAG);
    refresh();
    return { message };
  } catch (error) {
    if (error instanceof ServiceAdminError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: firstIssue(error) };
    throw error;
  }
}

export async function saveServiceLevelAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return servicesChange(async () => {
    const level: ServiceLevel = levelKind.parse(data.get("level"));
    const levelId = data.get("id") ? id.parse(data.get("id")) : null;
    const parentId = data.get("parentId") ? id.parse(data.get("parentId")) : null;
    const parsed = levelSchema.parse({
      title: data.get("title"),
      slug: data.get("slug") ?? "",
      shortDescription: data.get("shortDescription"),
      isVisible: data.get("isVisible") === "on",
    });
    await saveLevel(level, levelId, parentId, parsed);
    return levelId ? "Saved." : "Added.";
  });
}

export async function serviceLevelCommandAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return servicesChange(async () => {
    const level = levelKind.parse(data.get("level"));
    const levelId = id.parse(data.get("id"));
    const command = z.enum(["up", "down", "delete", "remove-image"]).parse(data.get("command"));
    if (command === "delete") await deleteLevel(level, levelId);
    else if (command === "remove-image") await removeLevelImage(level, levelId);
    else await moveLevel(level, levelId, command);
    return { delete: "Deleted.", "remove-image": "Image removed.", up: "Order saved.", down: "Order saved." }[command];
  });
}

export async function uploadServiceImageAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return servicesChange(async () => {
    const file = data.get("image");
    if (!(file instanceof File) || file.size === 0) throw new ServiceAdminError("Choose an image to upload.");
    await setLevelImage(levelKind.parse(data.get("level")), id.parse(data.get("id")), new Uint8Array(await file.arrayBuffer()));
    return "Image uploaded.";
  });
}

export async function linkServiceProductAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return servicesChange(async () => {
    const productId = data.get("productId");
    if (!productId) throw new ServiceAdminError("Choose a product.");
    await linkProduct(id.parse(productId), levelKind.parse(data.get("level")), id.parse(data.get("id")));
    updateTag("catalog");
    return "Product linked.";
  });
}

export async function unlinkServiceProductAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return servicesChange(async () => {
    await unlinkProduct(id.parse(data.get("productId")));
    updateTag("catalog");
    return "Product unlinked.";
  });
}
