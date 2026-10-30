"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { generateCategoryImage, generateProductImage, ImageGenerationError, type ImageView } from "@/lib/images/generate";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import {
  addProductImage,
  AdminInputError,
  deleteProductImage,
  moveCategory,
  removeCategoryImage,
  reorderProductImages,
  saveCategory,
  setCategoryImage,
  setCategoryVisibility,
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

/** Hides a product from the website (status ARCHIVED). Products are never deleted. */
export async function hideProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.product.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED" } });
  updateTag(CATALOG_TAG);
  redirect("/admin/products?hidden=1");
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
    content: formData.get("content") ?? "",
    parentId: formData.get("parentId") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
    isVisible: formData.get("isVisible") === "on",
    priceFrom: formData.get("priceFrom") ?? "",
    priceUnit: formData.get("priceUnit") ?? "",
    imageAlt: formData.get("imageAlt") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
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

export async function categoryCommandAction(
  categoryId: string,
  command: "up" | "down" | "show" | "hide" | "remove-image",
): Promise<AdminResult> {
  await requireAdmin();
  const target = id.parse(categoryId);
  const result = await run(async () => {
    const cmd = z.enum(["up", "down", "show", "hide", "remove-image"]).parse(command);
    if (cmd === "up" || cmd === "down") await moveCategory(target, cmd);
    else if (cmd === "remove-image") await removeCategoryImage(target);
    else await setCategoryVisibility(target, cmd === "show");
  });
  if (!result.error) catalogChanged();
  return result;
}

export async function uploadCategoryImageAction(formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const file = formData.get("image");
  const result = await run(async () => {
    if (!(file instanceof File) || file.size === 0) throw new AdminInputError("Choose an image to upload.");
    const alt = formData.get("imageAlt");
    await setCategoryImage(id.parse(formData.get("id")), new Uint8Array(await file.arrayBuffer()), typeof alt === "string" ? alt : undefined);
  });
  if (!result.error) catalogChanged();
  return result;
}

// ─── AI images (OpenAI, key from IMAGE_API_KEY on the server) ───────────────

export async function generateProductImageAction(productId: string, view: ImageView, replaceImageId?: string): Promise<AdminResult> {
  await requireAdmin();
  try {
    await generateProductImage(id.parse(productId), z.enum(["front", "angle", "in-use"]).parse(view), replaceImageId ? id.parse(replaceImageId) : undefined);
  } catch (error) {
    if (error instanceof ImageGenerationError) return { error: error.message };
    throw error;
  }
  catalogChanged();
  return {};
}

export async function generateCategoryImageAction(categoryId: string): Promise<AdminResult> {
  await requireAdmin();
  try {
    await generateCategoryImage(id.parse(categoryId));
  } catch (error) {
    if (error instanceof ImageGenerationError) return { error: error.message };
    throw error;
  }
  catalogChanged();
  return {};
}
