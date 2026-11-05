"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { addCategoryGalleryImages, saveCategoryFull, setCategoryOgImage } from "@/lib/admin/category-full";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { RATES_TAG } from "@/lib/rates/queries";
import { removeRateItemImage, setRateItemImage } from "@/lib/rates/admin";

// Admin → Categories & Services → Edit all settings. Admins only; every save updates the website and the app.

const id = z.string().min(1).max(200);
type Result = { error?: string; message?: string };

function changed() {
  updateTag(CATALOG_TAG);
  updateTag(RATES_TAG);
  refresh();
}

async function run(fn: () => Promise<void>, message: string): Promise<Result> {
  await requireStaff(["ADMIN"]);
  try {
    await fn();
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
  changed();
  return { message };
}

/** The one Save button: basic info, rates & calculator, commission, features, gallery details and SEO. */
export async function saveCategoryFullAction(categoryId: string, payload: unknown): Promise<Result> {
  return run(() => saveCategoryFull(id.parse(categoryId), payload), "All settings saved.");
}

export async function uploadCategoryGalleryAction(data: FormData): Promise<Result> {
  return run(async () => {
    const files = data.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new AdminInputError("Choose one or more images.");
    await addCategoryGalleryImages(id.parse(data.get("id")), await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer()))));
  }, "Images added.");
}

export async function uploadCategoryOgImageAction(data: FormData): Promise<Result> {
  return run(async () => {
    const file = data.get("image");
    if (!(file instanceof File) || file.size === 0) throw new AdminInputError("Choose an image.");
    await setCategoryOgImage(id.parse(data.get("id")), new Uint8Array(await file.arrayBuffer()));
  }, "Social image saved.");
}

export async function removeCategoryOgImageAction(categoryId: string): Promise<Result> {
  return run(() => setCategoryOgImage(id.parse(categoryId), null), "Social image removed.");
}

export async function uploadRateQualityImageAction(data: FormData): Promise<Result> {
  return run(async () => {
    const file = data.get("image");
    if (!(file instanceof File) || file.size === 0) throw new AdminInputError("Choose an image.");
    await setRateItemImage(id.parse(data.get("id")), new Uint8Array(await file.arrayBuffer()));
  }, "Quality image saved.");
}

export async function removeRateQualityImageAction(itemId: string): Promise<Result> {
  return run(() => removeRateItemImage(id.parse(itemId)), "Quality image removed.");
}
