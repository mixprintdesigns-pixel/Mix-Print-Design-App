"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { AdminInputError } from "@/lib/admin/catalog-service";
import {
  addWallpaperDesign,
  addWallpaperExtraImage,
  deleteWallpaperDesign,
  removeWallpaperExtraImage,
  saveWallpaperCategories,
  saveWallpaperDesign,
} from "@/lib/wallpaper/admin";
import { WALLPAPER_TAG } from "@/lib/wallpaper/queries";
import type { ActionState } from "../affiliate-actions";

// Admin → 3D Wallpaper Gallery. Admins and staff (the team needs the print-file links).

const id = z.string().min(1).max(50);

async function run(fn: () => Promise<string | void>, message: string): Promise<ActionState> {
  await requireStaff();
  try {
    const extra = await fn();
    updateTag(WALLPAPER_TAG);
    refresh();
    return { message: extra ? `${message} (${extra})` : message };
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
}

const fileBytes = async (data: FormData, field = "image") => {
  const file = data.get(field);
  if (!(file instanceof File) || file.size === 0) throw new AdminInputError("Choose a preview image.");
  return new Uint8Array(await file.arrayBuffer());
};

export async function saveWallpaperCategoriesAction(_prev: ActionState, data: FormData) {
  return run(() => saveWallpaperCategories(data), "Categories saved.");
}

export async function addWallpaperDesignAction(_prev: ActionState, data: FormData) {
  return run(async () => addWallpaperDesign(data, await fileBytes(data)), "Design added");
}

export async function saveWallpaperDesignAction(_prev: ActionState, data: FormData) {
  return run(() => saveWallpaperDesign(id.parse(data.get("id")), data), "Saved.");
}

export async function deleteWallpaperDesignAction(_prev: ActionState, data: FormData) {
  return run(() => deleteWallpaperDesign(id.parse(data.get("id"))), "Design deleted.");
}

export async function addWallpaperExtraImageAction(_prev: ActionState, data: FormData) {
  return run(async () => addWallpaperExtraImage(id.parse(data.get("id")), await fileBytes(data)), "Preview added.");
}

export async function removeWallpaperExtraImageAction(_prev: ActionState, data: FormData) {
  return run(() => removeWallpaperExtraImage(id.parse(data.get("id")), z.string().min(1).max(300).parse(data.get("key"))), "Preview removed.");
}
