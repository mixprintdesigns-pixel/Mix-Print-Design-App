import "server-only";
import sharp from "sharp";
import { deleteFile, saveFile } from "@/lib/storage";
import { blobStoreIdFromToken } from "@/lib/storage/blob-direct";
import { describeStorageError } from "@/lib/storage/errors";
import { checkImage } from "@/lib/storage/images";
import { descriptiveKey } from "@/lib/storage/webp";
import { BlogInputError } from "./admin";

// Blog images are stored as WebP: covers exactly 1200 × 630 (the social-share size), images inside
// articles at most 1600 px wide. The browser usually prepares them already (see components/admin/blog/prepare-image.ts);
// anything else is converted here.

export type BlogImageKind = "cover" | "inline";
export const BLOG_UPLOAD_PREFIX = "blog/upload-";
export const COVER_SIZE = { width: 1200, height: 630 };
export const INLINE_MAX_WIDTH = 1600;

export type StoredBlogImage = { url: string; width: number; height: number };

async function toBlogWebp(bytes: Uint8Array, kind: BlogImageKind): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const check = checkImage(bytes);
  if (!check.ok) throw new BlogInputError(check.error, "image");
  try {
    const pipeline = sharp(bytes).rotate();
    const resized =
      kind === "cover"
        ? pipeline.resize({ ...COVER_SIZE, fit: "cover", position: "attention" })
        : pipeline.resize({ width: INLINE_MAX_WIDTH, withoutEnlargement: true });
    const { data, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    return { bytes: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new BlogInputError("This image could not be read. Try saving it again as JPG or PNG.", "image");
  }
}

async function store(bytes: Uint8Array, name: string): Promise<string> {
  try {
    return (await saveFile(descriptiveKey("blog", name || "blog image", "webp"), bytes, "image/webp")).url;
  } catch (error) {
    throw new BlogInputError(describeStorageError(error), "image");
  }
}

/** An uploaded file (server upload): converted and stored. */
export async function saveBlogImage(bytes: Uint8Array, kind: BlogImageKind, name: string): Promise<StoredBlogImage> {
  const image = await toBlogWebp(bytes, kind);
  return { url: await store(image.bytes, name), width: image.width, height: image.height };
}

/** True only for a file in our own Blob store's blog upload folder. */
export function isOwnBlogUpload(url: string, env: Record<string, string | undefined> = process.env): boolean {
  const storeId = blobStoreIdFromToken(env.BLOB_READ_WRITE_TOKEN);
  if (!storeId) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === `${storeId.toLowerCase()}.public.blob.vercel-storage.com` && decodeURIComponent(u.pathname).startsWith(`/${BLOG_UPLOAD_PREFIX}`);
  } catch {
    return false;
  }
}

/** A file the browser uploaded straight to Vercel Blob: kept if it is already right, otherwise converted. */
export async function acceptDirectBlogUpload(url: string, kind: BlogImageKind, name: string): Promise<StoredBlogImage> {
  if (!isOwnBlogUpload(url)) throw new BlogInputError("This upload is not from our image storage.", "image");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new BlogInputError(`The uploaded file could not be read back from storage (HTTP ${response.status}).`, "image");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) {
    await deleteFile(url).catch(() => {});
    throw new BlogInputError(check.error, "image");
  }
  const meta = await sharp(bytes).metadata().catch(() => null);
  const ready =
    check.type === "image/webp" &&
    !!meta?.width &&
    !!meta.height &&
    (kind === "cover" ? meta.width === COVER_SIZE.width && meta.height === COVER_SIZE.height : meta.width <= INLINE_MAX_WIDTH);
  if (ready) return { url, width: meta!.width!, height: meta!.height! };
  const saved = await saveBlogImage(bytes, kind, name);
  await deleteFile(url).catch(() => {});
  return saved;
}
