import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { deleteFile, saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";
import { describeStorageError } from "@/lib/storage/errors";
import { isOwnProductUpload } from "@/lib/storage/blob-direct";
import { checkImage } from "@/lib/storage/images";
import sharp from "sharp";
import type { CategoryData, FieldErrorMap, ProductData } from "./product-input";

/** A problem the admin can fix; `field` points at the input to highlight. */
export class AdminInputError extends Error {
  constructor(
    message: string,
    public field = "_form",
  ) {
    super(message);
  }
  toErrors(): FieldErrorMap {
    return { [this.field]: this.message };
  }
}

type PrismaUniqueError = {
  code?: string;
  meta?: {
    target?: string[] | string;
    modelName?: string;
    driverAdapterError?: { cause?: { constraint?: { fields?: string[]; index?: string } } };
  };
};

/** Field names of a unique-constraint violation (P2002), or null for any other error. */
export function uniqueViolation(error: unknown): string[] | null {
  const e = error as PrismaUniqueError;
  if (e?.code !== "P2002") return null;
  if (e.meta?.target) return Array.isArray(e.meta.target) ? e.meta.target : [e.meta.target];
  const constraint = e.meta?.driverAdapterError?.cause?.constraint;
  if (constraint?.fields) return constraint.fields;
  // With driver adapters Prisma reports the index name, e.g. "Product_sku_key".
  const match = constraint?.index?.match(/^[A-Za-z]+_(.+)_key$/);
  return match ? match[1].split("_") : [];
}

// ─── Products ────────────────────────────────────────────────────────────────

/** Creates or updates a product with its tiers, discounts and options. Returns the product id. */
export async function saveProduct(id: string | null, data: ProductData): Promise<string> {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!category) throw new AdminInputError("Choose a category.", "categoryId");

  if (data.status === "PUBLISHED") {
    const images = id ? await prisma.productImage.count({ where: { productId: id } }) : 0;
    if (images === 0) {
      throw new AdminInputError("Add at least one image before publishing. Save as draft first, then upload images.", "status");
    }
  }

  const scalars = {
    sku: data.sku,
    name: data.name,
    slug: data.slug,
    categoryId: data.categoryId,
    summary: data.summary,
    description: data.description,
    basePriceMinor: data.basePrice,
    minQuantity: data.minQuantity,
    quantityStep: data.quantityStep,
    turnaroundDays: data.turnaroundDays,
    status: data.status,
    isAvailable: data.isAvailable,
    isFeatured: data.isFeatured,
    allowsDesignService: data.allowsDesignService,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    affiliateCommissionBps: data.affiliateCommission,
    affiliateCommissionMinor: data.affiliateCommissionAmount,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const product = id
        ? await tx.product.update({ where: { id }, data: scalars, select: { id: true } })
        : await tx.product.create({ data: scalars, select: { id: true } });

      await tx.priceTier.deleteMany({ where: { productId: product.id } });
      await tx.priceTier.createMany({
        data: data.priceTiers.map((t) => ({ productId: product.id, minQuantity: t.minQuantity, unitPriceMinor: t.unitPrice })),
      });
      await tx.bulkDiscount.deleteMany({ where: { productId: product.id } });
      await tx.bulkDiscount.createMany({
        data: data.bulkDiscounts.map((d) => ({ productId: product.id, minQuantity: d.minQuantity, percentBps: d.percent })),
      });

      await syncOptions(tx, product.id, data.options);
      return product.id;
    });
  } catch (error) {
    const fields = uniqueViolation(error);
    if (fields?.includes("sku")) throw new AdminInputError("Another product already uses this SKU.", "sku");
    if (fields?.includes("slug")) throw new AdminInputError("Another product already uses this slug.", "slug");
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      throw new AdminInputError("This product no longer exists.");
    }
    throw error;
  }
}

/**
 * Updates options in place instead of recreating them, so option value ids stay the same and
 * customers' carts keep working after an edit. Removed options and values are deleted.
 */
async function syncOptions(tx: Prisma.TransactionClient, productId: string, options: ProductData["options"]) {
  const existing = await tx.productOption.findMany({ where: { productId }, include: { values: true } });
  const existingById = new Map(existing.map((o) => [o.id, o]));
  const keptIds = new Set(options.map((o) => o.id).filter((id): id is string => !!id && existingById.has(id)));

  await tx.productOption.deleteMany({ where: { productId, id: { notIn: [...keptIds] } } });
  // Temporary names avoid unique-constraint clashes when options or values swap names.
  for (const id of keptIds) {
    await tx.productOption.update({ where: { id }, data: { name: `__tmp_${id}` } });
    for (const value of existingById.get(id)!.values) {
      await tx.productOptionValue.update({ where: { id: value.id }, data: { label: `__tmp_${value.id}` } });
    }
  }

  for (const [sortOrder, option] of options.entries()) {
    const current = option.id ? existingById.get(option.id) : undefined;
    const optionId = current
      ? (await tx.productOption.update({ where: { id: current.id }, data: { name: option.name, kind: option.kind, sortOrder } })).id
      : (await tx.productOption.create({ data: { productId, name: option.name, kind: option.kind, sortOrder } })).id;

    const currentValueIds = new Set(current?.values.map((v) => v.id) ?? []);
    const keptValueIds = option.values.map((v) => v.id).filter((id): id is string => !!id && currentValueIds.has(id));
    await tx.productOptionValue.deleteMany({ where: { optionId, id: { notIn: keptValueIds } } });

    for (const [valueOrder, value] of option.values.entries()) {
      const data = { label: value.label, priceDeltaMinor: value.priceDelta, pricing: value.pricing, sortOrder: valueOrder };
      if (value.id && currentValueIds.has(value.id)) await tx.productOptionValue.update({ where: { id: value.id }, data });
      else await tx.productOptionValue.create({ data: { ...data, optionId } });
    }
  }
}

/** Deletes a product, or archives it if it has been ordered (order history must keep it). */
export async function deleteProduct(id: string): Promise<"deleted" | "archived"> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { _count: { select: { orderItems: true } }, images: { select: { storageKey: true } } },
  });
  if (!product) return "deleted";
  if (product._count.orderItems > 0) {
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    return "archived";
  }
  await prisma.product.delete({ where: { id } });
  await Promise.all(product.images.map((i) => (i.storageKey ? deleteFile(i.storageKey).catch(() => {}) : null)));
  return "deleted";
}

// ─── Product images ──────────────────────────────────────────────────────────

/**
 * Saves an image the admin's browser uploaded straight to Vercel Blob (see lib/storage/blob-direct.ts).
 * A WebP within 1000 × 1000 is used as is; anything else is converted here and the original removed.
 */
export async function attachUploadedProductImage(productId: string, url: string) {
  if (!isOwnProductUpload(url, productId)) throw new AdminInputError("This upload is not from our image storage.", "image");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, images: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!product) throw new AdminInputError("This product no longer exists.");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new AdminInputError(`The uploaded file could not be read back from storage (HTTP ${response.status}).`, "image");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) {
    await deleteFile(url).catch(() => {});
    throw new AdminInputError(check.error, "image");
  }

  let stored = { key: url, url };
  const meta = await sharp(bytes).metadata().catch(() => null);
  const ready = check.type === "image/webp" && meta?.width && meta.height && Math.max(meta.width, meta.height) <= PRODUCT_UPLOAD_MAX_PX;
  if (!ready) {
    const image = await toWebp(bytes, PRODUCT_UPLOAD_MAX_PX, PRODUCT_UPLOAD_MAX_PX);
    if (!image.ok) throw new AdminInputError(image.error, "image");
    try {
      stored = await saveFile(descriptiveKey(`products/${productId}`, product.name, image.ext), image.bytes, image.type);
    } catch (error) {
      throw new AdminInputError(describeStorageError(error), "image");
    }
    await deleteFile(url).catch(() => {});
  }

  return prisma.productImage.create({
    data: {
      productId,
      url: stored.url,
      storageKey: stored.key,
      alt: product.name.slice(0, 200),
      sortOrder: (product.images[0]?.sortOrder ?? -1) + 1,
    },
  });
}

/** Uploaded product photos are stored as WebP within 1000 × 1000 pixels. */
export const PRODUCT_UPLOAD_MAX_PX = 1000;

export async function addProductImage(productId: string, bytes: Uint8Array, alt?: string, opts: { maxPx?: number } = {}) {
  const image = opts.maxPx ? await toWebp(bytes, opts.maxPx, opts.maxPx) : await toWebp(bytes);
  if (!image.ok) throw new AdminInputError(image.error, "image");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, images: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!product) throw new AdminInputError("This product no longer exists.");

  const label = alt?.trim() || product.name;
  let stored;
  try {
    stored = await saveFile(descriptiveKey(`products/${productId}`, label, image.ext), image.bytes, image.type);
  } catch (error) {
    throw new AdminInputError(describeStorageError(error), "image");
  }
  return prisma.productImage.create({
    data: {
      productId,
      url: stored.url,
      storageKey: stored.key,
      alt: alt?.trim().slice(0, 200) || product.name,
      sortOrder: (product.images[0]?.sortOrder ?? -1) + 1,
    },
  });
}

export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    include: { product: { select: { status: true, _count: { select: { images: true } } } } },
  });
  if (!image) return;
  if (image.product.status === "PUBLISHED" && image.product._count.images <= 1) {
    throw new AdminInputError("A published product needs at least one image. Upload another image first, or unpublish it.");
  }
  await prisma.productImage.delete({ where: { id: image.id } });
  if (image.storageKey) await deleteFile(image.storageKey).catch(() => {});
}

/** Saves a new image order; the first image becomes the main image. */
export async function reorderProductImages(productId: string, orderedIds: string[]): Promise<void> {
  const images = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
  const ids = new Set(images.map((i) => i.id));
  if (orderedIds.length !== ids.size || !orderedIds.every((id) => ids.has(id))) {
    throw new AdminInputError("The image list changed. Reload the page and try again.");
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.productImage.update({ where: { id }, data: { sortOrder } })),
  );
}

export async function updateProductImageAlt(productId: string, imageId: string, alt: string): Promise<void> {
  const text = alt.trim().slice(0, 200);
  if (!text) throw new AdminInputError("Describe the image for customers using screen readers.", "alt");
  await prisma.productImage.updateMany({ where: { id: imageId, productId }, data: { alt: text } });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function saveCategory(id: string | null, input: CategoryData): Promise<string> {
  const { priceFrom, ...rest } = input;
  const data = { ...rest, priceFromMinor: priceFrom };
  if (data.parentId) {
    // Walk up from the new parent; reaching this category would create a loop.
    let cursor: string | null = data.parentId;
    while (cursor) {
      if (cursor === id) throw new AdminInputError("A category cannot be inside itself or its subcategories.", "parentId");
      const parent: { parentId: string | null } | null = await prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      if (!parent) throw new AdminInputError("Parent category not found.", "parentId");
      cursor = parent.parentId;
    }
  }
  // Slugs only need to be unique among siblings (the URL is the path of slugs). Checked here because
  // the database index treats every main service (no parent) as distinct.
  const clash = await prisma.category.findFirst({
    where: { parentId: data.parentId, slug: data.slug, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (clash) throw new AdminInputError("Another category at this level already uses this slug.", "slug");
  try {
    const category = id
      ? await prisma.category.update({ where: { id }, data, select: { id: true } })
      : await prisma.category.create({ data, select: { id: true } });
    return category.id;
  } catch (error) {
    if (uniqueViolation(error)) throw new AdminInputError("Another category at this level already uses this slug.", "slug");
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      throw new AdminInputError("This category no longer exists.");
    }
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id },
    select: { imageKey: true, _count: { select: { products: true, children: true } } },
  });
  if (!category) return;
  if (category._count.children > 0) throw new AdminInputError("Move or delete its subcategories first.");
  if (category._count.products > 0) throw new AdminInputError("Move its products to another category first.");
  await prisma.category.delete({ where: { id } });
  if (category.imageKey) await deleteFile(category.imageKey).catch(() => {});
}

/** Moves a category one place up or down among its siblings (renumbers the siblings 0, 1, 2, …). */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id }, select: { parentId: true } });
  if (!category) throw new AdminInputError("This category no longer exists.");
  const siblings = await prisma.category.findMany({
    where: { parentId: category.parentId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  const ids = siblings.map((s) => s.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  await prisma.$transaction(ids.map((siblingId, sortOrder) => prisma.category.update({ where: { id: siblingId }, data: { sortOrder } })));
}

export async function setCategoryVisibility(id: string, isVisible: boolean): Promise<void> {
  await prisma.category.updateMany({ where: { id }, data: { isVisible } });
}

/** Stores a category image as WebP with a descriptive file name, replacing any previous image. */
export async function setCategoryImage(id: string, bytes: Uint8Array, alt?: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id }, select: { name: true, imageKey: true, imageAlt: true } });
  if (!category) throw new AdminInputError("This category no longer exists.");
  const image = await toWebp(bytes);
  if (!image.ok) throw new AdminInputError(image.error, "image");
  const stored = await saveFile(descriptiveKey("categories", category.name, image.ext), image.bytes, image.type);
  await prisma.category.update({
    where: { id },
    data: { imageUrl: stored.url, imageKey: stored.key, imageAlt: alt?.trim().slice(0, 200) || category.imageAlt || category.name },
  });
  if (category.imageKey) await deleteFile(category.imageKey).catch(() => {});
}

export async function removeCategoryImage(id: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id }, select: { imageKey: true } });
  if (!category) return;
  await prisma.category.update({ where: { id }, data: { imageUrl: null, imageKey: null } });
  if (category.imageKey) await deleteFile(category.imageKey).catch(() => {});
}

// ─── Reads for admin pages (never cached: staff need fresh data) ─────────────

export async function listAdminProducts(filter: { q?: string; status?: string }) {
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filter.status ?? "")
    ? (filter.status as "DRAFT" | "PUBLISHED" | "ARCHIVED")
    : undefined;
  const q = filter.q?.trim();
  return prisma.product.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      status: true,
      isAvailable: true,
      isFeatured: true,
      basePriceMinor: true,
      updatedAt: true,
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
    },
  });
}

export async function getAdminProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      priceTiers: { orderBy: { minQuantity: "asc" } },
      bulkDiscounts: { orderBy: { minQuantity: "asc" } },
      options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}
export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

export async function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      content: true,
      parentId: true,
      sortOrder: true,
      isVisible: true,
      imageUrl: true,
      imageAlt: true,
      priceFromMinor: true,
      priceUnit: true,
      seoTitle: true,
      seoDescription: true,
      _count: { select: { products: true, children: true } },
    },
  });
}

export async function getDashboardCounts() {
  const [published, drafts, unavailable, customers, categories] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.product.count({ where: { status: "DRAFT" } }),
    prisma.product.count({ where: { status: "PUBLISHED", isAvailable: false } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.category.count(),
  ]);
  return { published, drafts, unavailable, customers, categories };
}
