import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { attachUploadedProductImage } from "@/lib/admin/catalog-service";
import { blobStoreIdFromToken, directUploadAvailable, isOwnProductUpload } from "@/lib/storage/blob-direct";
import { createTestProduct, resetDatabase } from "../support/db";

// Direct uploads to Vercel Blob: the browser uploads the file, then the server checks and records it.

const TOKEN = "vercel_blob_rw_AbC123xyz_secretpart";
const HOST = "https://abc123xyz.public.blob.vercel-storage.com";
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

beforeEach(async () => {
  await resetDatabase();
  process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
});
afterEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const image = (width: number, height: number, format: "webp" | "png") =>
  sharp({ create: { width, height, channels: 3, background: "#00AFEF" } })[format]().toBuffer();

function serve(bytes: Buffer) {
  const fetchMock = vi.fn(async () => new Response(new Uint8Array(bytes), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("direct upload helpers", () => {
  it("reads the store id from the token and only accepts our own product folder", () => {
    expect(blobStoreIdFromToken(TOKEN)).toBe("AbC123xyz");
    expect(blobStoreIdFromToken("something-else")).toBeNull();
    expect(directUploadAvailable({ BLOB_READ_WRITE_TOKEN: TOKEN })).toBe(true);
    expect(directUploadAvailable({})).toBe(false);
    expect(isOwnProductUpload(`${HOST}/products/p1/upload-card-Xy12.webp`, "p1")).toBe(true);
    expect(isOwnProductUpload(`${HOST}/products/p2/upload-card.webp`, "p1")).toBe(false);
    expect(isOwnProductUpload("https://other.public.blob.vercel-storage.com/products/p1/upload-a.webp", "p1")).toBe(false);
    expect(isOwnProductUpload(`http://abc123xyz.public.blob.vercel-storage.com/products/p1/upload-a.webp`, "p1")).toBe(false);
  });
});

describe("attaching an uploaded image", () => {
  it("records a browser-made WebP within 1000 px as is, without uploading again", async () => {
    const product = await createTestProduct();
    serve(await image(1000, 750, "webp"));
    const storage = await import("@/lib/storage");
    const save = vi.spyOn(storage, "saveFile");
    const url = `${HOST}/products/${product.id}/upload-card-Ab12.webp`;
    const saved = await attachUploadedProductImage(product.id, url);
    expect(saved).toMatchObject({ url, storageKey: url, productId: product.id });
    expect(save).not.toHaveBeenCalled();
  });

  it("converts anything else to WebP within 1000 × 1000 and removes the original", async () => {
    const product = await createTestProduct();
    serve(await image(3000, 1500, "png"));
    const storage = await import("@/lib/storage");
    const save = vi.spyOn(storage, "saveFile").mockImplementation(async (key) => ({ key: `${HOST}/${key}`, url: `${HOST}/${key}` }));
    const remove = vi.spyOn(storage, "deleteFile").mockResolvedValue();
    const url = `${HOST}/products/${product.id}/upload-big-Zz99.png`;
    const saved = await attachUploadedProductImage(product.id, url);
    expect(saved.url).toMatch(/\.webp$/);
    const [, bytes, type] = save.mock.calls[0];
    expect(type).toBe("image/webp");
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 1000, height: 500 });
    expect(remove).toHaveBeenCalledWith(url);
  });

  it("refuses files from elsewhere and non-images, with a clear message", async () => {
    const product = await createTestProduct();
    await expect(attachUploadedProductImage(product.id, "https://evil.example.com/x.webp")).rejects.toThrow(/not from our image storage/);
    serve(Buffer.from("<svg></svg>"));
    const storage = await import("@/lib/storage");
    vi.spyOn(storage, "deleteFile").mockResolvedValue();
    await expect(attachUploadedProductImage(product.id, `${HOST}/products/${product.id}/upload-x.webp`)).rejects.toThrow(/JPG, PNG or WebP/);
    expect(await prisma.productImage.count()).toBe(0);
  });

  it("explains when the uploaded file cannot be read back", async () => {
    const product = await createTestProduct();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(attachUploadedProductImage(product.id, `${HOST}/products/${product.id}/upload-x.webp`)).rejects.toThrow(/HTTP 404/);
  });
});
