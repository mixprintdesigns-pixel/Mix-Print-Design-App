import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { addProductImage, AdminInputError, PRODUCT_UPLOAD_MAX_PX } from "@/lib/admin/catalog-service";
import { describeStorageError } from "@/lib/storage/errors";
import { readLocalFile } from "@/lib/storage";
import { createTestProduct, resetDatabase } from "../support/db";

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());

const photo = (width: number, height: number, format: "jpeg" | "png" | "webp") =>
  sharp({ create: { width, height, channels: 3, background: "#00AFEF" } })
    [format]()
    .toBuffer()
    .then((b) => new Uint8Array(b));

describe("product image upload", () => {
  it.each(["jpeg", "png", "webp"] as const)("saves a %s as WebP within 1000 × 1000", async (format) => {
    const product = await createTestProduct();
    const image = await addProductImage(product.id, await photo(3000, 2000, format), undefined, { maxPx: PRODUCT_UPLOAD_MAX_PX });
    expect(image.url).toMatch(/\.webp$/);
    const saved = await readLocalFile(image.storageKey!);
    const meta = await sharp(saved!).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1000, height: 667 });
  });

  it("keeps tall images within 1000 px high and never enlarges small ones", async () => {
    const product = await createTestProduct();
    const tall = await addProductImage(product.id, await photo(800, 2400, "jpeg"), undefined, { maxPx: PRODUCT_UPLOAD_MAX_PX });
    expect(await sharp((await readLocalFile(tall.storageKey!))!).metadata()).toMatchObject({ width: 333, height: 1000 });
    const small = await addProductImage(product.id, await photo(300, 200, "png"), undefined, { maxPx: PRODUCT_UPLOAD_MAX_PX });
    expect(await sharp((await readLocalFile(small.storageKey!))!).metadata()).toMatchObject({ width: 300, height: 200 });
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(2);
  });

  it("turns a storage failure into a clear message instead of crashing", async () => {
    const product = await createTestProduct();
    const storage = await import("@/lib/storage");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(storage, "saveFile").mockRejectedValueOnce(Object.assign(new Error("EROFS: read-only file system"), { code: "EROFS" }));
    const upload = addProductImage(product.id, await photo(100, 100, "jpeg"), undefined, { maxPx: PRODUCT_UPLOAD_MAX_PX });
    await expect(upload).rejects.toBeInstanceOf(AdminInputError);
    await expect(upload).rejects.toThrow(/Image storage is not set up/);
    expect(await prisma.productImage.count()).toBe(0);
  });

  it("rejects files that are not JPG, PNG or WebP", async () => {
    const product = await createTestProduct();
    await expect(addProductImage(product.id, new TextEncoder().encode("<svg></svg>"))).rejects.toThrow(/JPG, PNG or WebP/);
  });
});

describe("storage error messages", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("explains a missing Blob store on Vercel", () => {
    quiet();
    expect(describeStorageError(new Error("x"), { VERCEL: "1" })).toMatch(/Storage → create a Blob store \(Public\)/);
  });

  it("explains a private Blob store", () => {
    quiet();
    const error = Object.assign(new Error("Cannot use public access on a private store"), { name: "BlobAccessError" });
    expect(describeStorageError(error, { VERCEL: "1", BLOB_READ_WRITE_TOKEN: "set" })).toMatch(/Private/);
  });

  it("falls back to the original reason", () => {
    quiet();
    expect(describeStorageError(new Error("network down"), {})).toMatch(/network down/);
  });
});
