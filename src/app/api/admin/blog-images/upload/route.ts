import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";
import { BLOG_UPLOAD_PREFIX } from "@/lib/blog/images";

// Gives the admin's browser a short-lived token to upload one blog image straight to Vercel Blob
// (no server size limit). The editor then calls attachBlogImageAction, which checks and records it.

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (user?.role !== "ADMIN") throw new Error("Only administrators can upload blog images. Please sign in again.");
        if (!pathname.startsWith(BLOG_UPLOAD_PREFIX) || pathname.includes("..") || pathname.slice(BLOG_UPLOAD_PREFIX.length).includes("/")) {
          throw new Error("Invalid file name.");
        }
        return { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("Blog image upload token error:", error);
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
