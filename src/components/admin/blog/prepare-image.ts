"use client";

// Prepares a blog image in the browser before upload: covers are cropped to 1200 × 630, images in the
// article are at most 1600 px wide, both saved as WebP. The server checks the result and converts anything
// a browser could not make (e.g. browsers without WebP encoding).

const COVER = { width: 1200, height: 630 };
const INLINE_MAX = 1600;

export async function prepareBlogImage(file: File, kind: "cover" | "inline"): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    if (kind === "cover") {
      canvas.width = COVER.width;
      canvas.height = COVER.height;
      // Fill the frame, cropping the overflow evenly from both sides.
      const scale = Math.max(COVER.width / bitmap.width, COVER.height / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.drawImage(bitmap, (COVER.width - w) / 2, (COVER.height - h) / 2, w, h);
    } else {
      const scale = Math.min(1, INLINE_MAX / bitmap.width);
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (blob && blob.type === "image/webp") return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return jpeg ? new File([jpeg], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // the server converts it
  }
}
