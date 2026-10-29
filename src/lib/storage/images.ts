// Upload validation for product images. The file type is detected from its first bytes,
// never trusted from the browser's Content-Type or file name.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit

const signatures: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

export type ImageCheck = { ok: true; type: string; ext: string } | { ok: false; error: string };

/** Accepts JPEG, PNG and WebP up to MAX_IMAGE_BYTES. SVG is refused because it can carry scripts. */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "Images must be 4 MB or smaller." };
  const match = signatures.find((s) => s.test(bytes));
  return match ? { ok: true, type: match.type, ext: match.ext } : { ok: false, error: "Use a JPG, PNG or WebP image." };
}
