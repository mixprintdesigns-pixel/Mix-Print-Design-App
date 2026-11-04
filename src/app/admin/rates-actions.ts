"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { addRateItem, createRatePage, removeRateItemImage, saveRateItem, saveRatePage, saveRateSettings, setRateItemImage } from "@/lib/rates/admin";
import { RATES_TAG } from "@/lib/rates/queries";
import type { ActionState } from "./affiliate-actions";

// Admin → Rates. Admins only. Every save updates the website and the app at once.

const id = z.string().min(1).max(50);
const requireAdmin = () => requireStaff(["ADMIN"]);

function ratesChanged() {
  updateTag(RATES_TAG);
  refresh();
}

async function run(fn: () => Promise<void>, message: string): Promise<ActionState> {
  try {
    await fn();
    ratesChanged();
    return { message };
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
}

export async function saveRateSettingsAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(() => saveRateSettings(data), "Settings saved.");
}

export async function createRatePageAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  let pageId: string;
  try {
    const created = await createRatePage(data);
    pageId = created.id;
    if (created.createdCategory) updateTag(CATALOG_TAG);
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
  ratesChanged();
  redirect(`/admin/rates/${pageId}?created=1`);
}

export async function saveRatePageAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(() => saveRatePage(id.parse(data.get("id")), data), "Page saved.");
}

export async function addRateItemAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await addRateItem(id.parse(data.get("pageId")), data);
  }, "Item added below: fill in its description and rate, then save it.");
}

export async function saveRateItemAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(() => saveRateItem(id.parse(data.get("id")), data), "Item saved.");
}

export async function uploadRateItemImageAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = data.get("image");
  return run(async () => {
    if (!(file instanceof File) || file.size === 0) throw new AdminInputError("Choose an image to upload.");
    const alt = data.get("imageAlt");
    await setRateItemImage(id.parse(data.get("id")), new Uint8Array(await file.arrayBuffer()), typeof alt === "string" ? alt : undefined);
  }, "Image uploaded.");
}

export async function removeRateItemImageAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(() => removeRateItemImage(id.parse(data.get("id"))), "Image removed.");
}
