"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import {
  addProductImage,
  AdminInputError,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  reorderProductImages,
  saveCategory,
  saveProduct,
  updateProductImageAlt,
} from "@/lib/admin/catalog-service";
import { categoryInputSchema, issuesToErrors, productInputSchema, type FieldErrorMap } from "@/lib/admin/product-input";

// Catalog changes are limited to administrators. Every action re-checks the session itself.
const requireAdmin = () => requireStaff(["ADMIN"]);

export type AdminFormState = { errors?: FieldErrorMap; ok?: boolean; savedAt?: number };
export type AdminResult = { error?: string };

const id = z.string().min(1).max(50);

function catalogChanged() {
  updateTag(CATALOG_TAG);
  refresh();
}

async function run(fn: () => Promise<void>): Promise<AdminResult> {
  try {
    await fn();
    return {};
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function saveProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const productId = formData.get("id") ? id.parse(formData.get("id")) : null;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { errors: { _form: "The form could not be read. Reload the page and try again." } };
  }
  const parsed = productInputSchema.safeParse(payload);
  if (!parsed.success) return { errors: issuesToErrors(parsed.error) };

  let savedId: string;
  try {
    savedId = await saveProduct(productId, parsed.data);
  } catch (error) {
    if (error instanceof AdminInputError) return { errors: error.toErrors() };
    throw error;
  }
  catalogChanged();
  // The editor remounts with fresh option ids after a save, so the confirmation comes from the URL.
  redirect(productId ? `/admin/products/${savedId}?saved=${Date.now()}` : `/admin/products/${savedId}?created=1`);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await deleteProduct(id.parse(formData.get("id")));
  updateTag(CATALOG_TAG);
  redirect(`/admin/products?${result}=1`);
}

// ─── Product images (called directly from the image manager) ────────────────

export async function uploadProductImageAction(formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const productId = id.parse(formData.get("productId"));
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image to upload." };
  const result = await run(async () => {
    await addProductImage(productId, new Uint8Array(await file.arrayBuffer()));
  });
  if (!result.error) catalogChanged();
  return result;
}

export async function deleteProductImageAction(productId: string, imageId: string): Promise<AdminResult> {
  await requireAdmin();
  const result = await run(() => deleteProductImage(id.parse(productId), id.parse(imageId)));
  if (!result.error) catalogChanged();
  return result;
}

export async function reorderProductImagesAction(productId: string, imageIds: string[]): Promise<AdminResult> {
  await requireAdmin();
  const result = await run(() => reorderProductImages(id.parse(productId), z.array(id).max(50).parse(imageIds)));
  if (!result.error) catalogChanged();
  return result;
}

export async function updateProductImageAltAction(productId: string, imageId: string, alt: string): Promise<AdminResult> {
  await requireAdmin();
  const result = await run(() =>
    updateProductImageAlt(id.parse(productId), id.parse(imageId), z.string().max(500).parse(alt)),
  );
  if (!result.error) catalogChanged();
  return result;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function saveCategoryAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const categoryId = formData.get("id") ? id.parse(formData.get("id")) : null;
  const parsed = categoryInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    parentId: formData.get("parentId") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { errors: issuesToErrors(parsed.error) };
  try {
    await saveCategory(categoryId, parsed.data);
  } catch (error) {
    if (error instanceof AdminInputError) return { errors: error.toErrors() };
    throw error;
  }
  catalogChanged();
  return { ok: true, savedAt: Date.now() };
}

export async function deleteCategoryAction(categoryId: string): Promise<AdminResult> {
  await requireAdmin();
  const result = await run(() => deleteCategory(id.parse(categoryId)));
  if (!result.error) catalogChanged();
  return result;
}
