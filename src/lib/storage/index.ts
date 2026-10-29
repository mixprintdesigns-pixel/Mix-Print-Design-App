import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// File storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production on Vercel,
// whose filesystem is read-only), otherwise the local disk under ./storage (development, tests).

export type StoredFile = { key: string; url: string };

export const LOCAL_ROOT = path.join(process.cwd(), "storage", "uploads");

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Random, unguessable key inside a folder, e.g. products/abc123/9f2c….jpg */
export function newKey(folder: string, ext: string): string {
  return `${folder}/${randomBytes(16).toString("hex")}.${ext}`;
}

export async function saveFile(key: string, bytes: Uint8Array, contentType: string): Promise<StoredFile> {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(bytes), { access: "public", contentType, addRandomSuffix: false });
    return { key: blob.url, url: blob.url };
  }
  const file = resolveLocal(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { key, url: `/media/${key}` };
}

export async function deleteFile(key: string): Promise<void> {
  if (key.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(key);
    return;
  }
  await unlink(resolveLocal(key)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function readLocalFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveLocal(key));
  } catch {
    return null;
  }
}

/** Maps a key to a path inside LOCAL_ROOT, rejecting anything that would escape it. */
export function resolveLocal(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const file = path.resolve(LOCAL_ROOT, key);
  if (!file.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
  return file;
}
