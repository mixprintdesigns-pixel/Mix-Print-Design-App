import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { productUploadPrefix } from "@/lib/storage/blob-direct";

// Gives the admin's browser a short-lived token to upload one product image straight to Vercel Blob.
// After the upload the image manager calls attachProductImageAction, which checks the file and saves it.

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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (user?.role !== "ADMIN") throw new Error("Only administrators can upload product images. Please sign in again.");
        const productId = clientPayload ?? "";
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!product) throw new Error("This product no longer exists.");
        if (!pathname.startsWith(productUploadPrefix(productId)) || pathname.includes("..")) throw new Error("Invalid file name.");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("Product image upload token error:", error);
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
