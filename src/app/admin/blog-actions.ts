"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireStaff } from "@/lib/auth/session";
import { BlogInputError, deleteBlogCategory, deleteBlogPost, saveBlogCategory, saveBlogPost, type BlogPostInput } from "@/lib/blog/admin";
import { acceptDirectBlogUpload, saveBlogImage, type BlogImageKind, type StoredBlogImage } from "@/lib/blog/images";
import { BLOG_TAG } from "@/lib/blog/queries";
import { blobStoreIdFromToken } from "@/lib/storage/blob-direct";
import type { ActionState } from "./affiliate-actions";

// Blog manager actions (administrators only).

const requireAdmin = () => requireStaff(["ADMIN"]);
const id = z.string().min(1).max(50);
const kind = z.enum(["cover", "inline"]);

function blogChanged() {
  updateTag(BLOG_TAG);
  refresh();
}

export type SaveBlogPostResult = { ok: true; id: string; slug: string } | { ok: false; error: string; field?: string };

export async function saveBlogPostAction(postId: string | null, input: BlogPostInput): Promise<SaveBlogPostResult> {
  await requireAdmin();
  try {
    const saved = await saveBlogPost(input, postId ? id.parse(postId) : null);
    blogChanged();
    return { ok: true, ...saved };
  } catch (error) {
    if (error instanceof BlogInputError) return { ok: false, error: error.message, field: error.field };
    console.error("Saving blog article failed:", error);
    return { ok: false, error: `Server error: ${(error as Error).message || String(error)}` };
  }
}

export async function deleteBlogPostAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  await deleteBlogPost(id.parse(data.get("postId")));
  updateTag(BLOG_TAG);
  redirect("/admin/blog?deleted=1");
}

// ─── Images ──────────────────────────────────────────────────────────────────

export type BlogImageResult = ({ ok: true } & StoredBlogImage) | { ok: false; error: string };

async function imageResult(fn: () => Promise<StoredBlogImage>): Promise<BlogImageResult> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (error) {
    if (error instanceof BlogInputError) return { ok: false, error: error.message };
    console.error("Blog image upload failed:", error);
    return { ok: false, error: `Server error: ${(error as Error).message || String(error)}` };
  }
}

/** Upload through our server (used when Vercel Blob is not set up, e.g. in development). */
export async function uploadBlogImageAction(data: FormData): Promise<BlogImageResult> {
  await requireAdmin();
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  const k = kind.parse(data.get("kind")) as BlogImageKind;
  return imageResult(async () => saveBlogImage(new Uint8Array(await file.arrayBuffer()), k, String(data.get("name") ?? "")));
}

/** Before a direct upload: the exact reason it cannot work, if any. */
export async function checkBlogImageUploadAction(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return { error: "Your admin session has ended. Please sign in again." };
  if (!blobStoreIdFromToken(process.env.BLOB_READ_WRITE_TOKEN)) {
    return { error: "BLOB_READ_WRITE_TOKEN is missing or not a Vercel Blob read-write token. Reconnect the Blob store, then redeploy." };
  }
  return {};
}

/** After a direct upload to Vercel Blob: checks the file and makes sure it is the right size and WebP. */
export async function attachBlogImageAction(url: string, imageKind: BlogImageKind, name: string): Promise<BlogImageResult> {
  await requireAdmin();
  return imageResult(() => acceptDirectBlogUpload(z.string().url().max(1000).parse(url), kind.parse(imageKind), name.slice(0, 100)));
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function saveBlogCategoryAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const categoryId = data.get("categoryId") ? id.parse(data.get("categoryId")) : null;
  try {
    await saveBlogCategory(
      {
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        description: String(data.get("description") ?? ""),
        sortOrder: String(data.get("sortOrder") ?? "0"),
      },
      categoryId,
    );
  } catch (error) {
    if (error instanceof BlogInputError) return { error: error.message };
    throw error;
  }
  blogChanged();
  return { message: categoryId ? "Category saved." : "Category added." };
}

export async function deleteBlogCategoryAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  await deleteBlogCategory(id.parse(data.get("categoryId")));
  blogChanged();
  return { message: "Category deleted. Its articles are kept, without a category." };
}
