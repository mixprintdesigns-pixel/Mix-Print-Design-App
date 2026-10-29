import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { toSlug } from "@/lib/slug";
import { checkImage } from "./images";

export type WebpImage = { ok: true; bytes: Uint8Array; type: "image/webp"; ext: "webp" } | { ok: false; error: string };

/**
 * Validates an uploaded JPG/PNG/WebP and converts it to a resized WebP (smaller files, faster pages).
 * Images wider than `maxWidth` are scaled down; EXIF orientation is applied and metadata is stripped.
 */
export async function toWebp(bytes: Uint8Array, maxWidth = 1600): Promise<WebpImage> {
  const check = checkImage(bytes);
  if (!check.ok) return check;
  try {
    const output = await sharp(bytes).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { ok: true, bytes: new Uint8Array(output), type: "image/webp", ext: "webp" };
  } catch {
    return { ok: false, error: "This image could not be read. Try saving it again as JPG or PNG." };
  }
}

/** A storage key with a descriptive, search-friendly file name, e.g. "categories/matte-business-cards-3fa9c1.webp". */
export function descriptiveKey(folder: string, name: string, ext: string): string {
  return `${folder}/${toSlug(name).slice(0, 60) || "image"}-${randomBytes(3).toString("hex")}.${ext}`;
}
