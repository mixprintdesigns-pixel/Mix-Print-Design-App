import "server-only";

// Direct ("client") uploads to Vercel Blob: the browser sends the file straight to Blob storage with a
// short-lived token from /api/admin/product-images/upload, so the file never passes through our server
// and Vercel's 4.5 MB request limit does not apply. Used when BLOB_READ_WRITE_TOKEN is set.

export const PRODUCT_UPLOAD_ROUTE = "/api/admin/product-images/upload";

export function directUploadAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** The store id inside a read-write token ("vercel_blob_rw_<storeId>_<secret>"). */
export function blobStoreIdFromToken(token: string | undefined): string | null {
  return token?.trim().match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1] ?? null;
}

/** Where the browser may upload images for a product: products/<id>/upload-<name>.<ext> */
export function productUploadPrefix(productId: string): string {
  return `products/${productId}/upload-`;
}

/** True only for a file in our own Blob store, inside this product's upload folder. */
export function isOwnProductUpload(url: string, productId: string, env: Record<string, string | undefined> = process.env): boolean {
  const storeId = blobStoreIdFromToken(env.BLOB_READ_WRITE_TOKEN);
  if (!storeId) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === `${storeId.toLowerCase()}.public.blob.vercel-storage.com` &&
    decodeURIComponent(parsed.pathname).startsWith(`/${productUploadPrefix(productId)}`)
  );
}
