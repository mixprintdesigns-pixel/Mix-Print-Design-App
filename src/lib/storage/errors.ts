import "server-only";

/**
 * Plain-language reason an uploaded image could not be saved, for the admin screen.
 * The full error is also logged, so it shows in Vercel → Logs.
 */
export function describeStorageError(error: unknown, env: Record<string, string | undefined> = process.env): string {
  console.error("Image storage error:", error);
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  const name = error instanceof Error ? error.name : "";

  if ((env.VERCEL && !env.BLOB_READ_WRITE_TOKEN) || code === "EROFS" || code === "EACCES") {
    return "Image storage is not set up. In Vercel, open the project → Storage → create a Blob store (Public) and connect it to this project, then redeploy.";
  }
  if (/private/i.test(message) || name === "BlobAccessError") {
    return "The Vercel Blob store is set to Private, so images cannot be shown on the website. Create a Public Blob store, connect it to this project, then redeploy.";
  }
  if (name === "BlobStoreSuspendedError" || /suspended/i.test(message)) {
    return "The Vercel Blob store is suspended (usually a plan or usage limit). Check Vercel → Storage.";
  }
  if (name === "BlobStoreNotFoundError" || /store.*not.*found|access denied|token/i.test(message)) {
    return "The Vercel Blob token is not valid for this project. Reconnect the Blob store to the project in Vercel → Storage, then redeploy.";
  }
  return `The image could not be saved (${message.slice(0, 150)}). Please try again.`;
}
