"use server";

// Admin actions for the website pages added in this stage: reviews, About page, SEO, contact messages.
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { REVIEWS_TAG } from "@/lib/reviews/queries";
import { deleteReview, moveReview, reviewSchema, saveReview } from "@/lib/reviews/admin";
import type { ActionState } from "./affiliate-actions";
import { setMessageHandled } from "@/lib/contact/service";
import { aboutSchema, CONTENT_TAG, getAboutContent, saveAboutContent } from "@/lib/content/about";
import { saveSeoPages, SEO_PAGES, seoPagesSchema, type SeoPageKey } from "@/lib/content/seo-pages";
import { saveSiteSettings, siteSettingsSchema } from "@/lib/content/site-settings";
import { newKey, saveFile } from "@/lib/storage";
import { checkImage } from "@/lib/storage/images";


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

// ─── About page ──────────────────────────────────────────────────────────────

export async function saveAboutAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  const current = await getAboutContent();
  let ownerPhotoUrl = data.get("removePhoto") === "on" ? "" : current.ownerPhotoUrl;

  const photo = data.get("ownerPhoto");
  if (photo instanceof File && photo.size > 0) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const check = checkImage(bytes);
    if (!check.ok) return { error: check.error };
    ownerPhotoUrl = (await saveFile(newKey("about", check.ext), bytes, check.type)).url;
  }

  const titles = data.getAll("highlightTitle").map(String);
  const texts = data.getAll("highlightText").map(String);
  const parsed = aboutSchema.safeParse({
    story: data.get("story"),
    mission: data.get("mission"),
    ownerName: data.get("ownerName"),
    ownerTitle: data.get("ownerTitle") ?? "",
    ownerBio: data.get("ownerBio") ?? "",
    ownerPhotoUrl,
    highlights: titles
      .map((title, i) => ({ title: title.trim(), text: (texts[i] ?? "").trim() }))
      .filter((h) => h.title || h.text),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await saveAboutContent(parsed.data);
  updateTag(CONTENT_TAG);
  refresh();
  return { message: "About page saved." };
}

// ─── SEO for fixed pages ─────────────────────────────────────────────────────

export async function saveSeoPagesAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  const entries = Object.fromEntries(
    (Object.keys(SEO_PAGES) as SeoPageKey[]).map((key) => [
      key,
      { title: String(data.get(`${key}.title`) ?? ""), description: String(data.get(`${key}.description`) ?? "") },
    ]),
  );
  const parsed = seoPagesSchema.safeParse(entries);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await saveSeoPages(parsed.data);
  updateTag(CONTENT_TAG);
  refresh();
  return { message: "SEO settings saved." };
}

// ─── Contact details, social links, map and tagline ──────────────────────────

export async function saveSiteSettingsAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  const field = (k: string) => String(data.get(k) ?? "");
  const parsed = siteSettingsSchema.safeParse({
    tagline: field("tagline"),
    address: field("address"),
    phoneDisplay: field("phoneDisplay"),
    whatsappNumber: field("whatsappNumber"),
    email: field("email"),
    facebookUrl: field("facebookUrl"),
    instagramUrl: field("instagramUrl"),
    tiktokUrl: field("tiktokUrl"),
    youtubeUrl: field("youtubeUrl"),
    mapEmbedUrl: field("mapEmbedUrl"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await saveSiteSettings(parsed.data);
  updateTag(CONTENT_TAG);
  refresh();
  return { message: "Contact details saved." };
}

// ─── Contact messages ────────────────────────────────────────────────────────

export async function setMessageHandledAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN", "STAFF"]);
  const handled = data.get("handled") === "1";
  await setMessageHandled(id.parse(data.get("id")), handled);
  refresh();
  return { message: handled ? "Marked as handled." : "Marked as open." };
}
