"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db";
import { normalisedYouTubeUrl, parseYouTubeUrl, toVideoPosition, type VideoPosition } from "@/lib/youtube";

// The optional YouTube video on a product (Admin → Products → product → Images).

export type ProductVideoResult = { ok: true; url: string | null } | { ok: false; error: string };

/** Saves (or, with an empty link, removes) the product's video and where it appears in the gallery. */
export async function saveProductVideoAction(productId: string, link: string, position: VideoPosition): Promise<ProductVideoResult> {
  await requireStaff(["ADMIN"]);
  const id = z.string().min(1).max(50).parse(productId);
  const text = String(link ?? "").trim().slice(0, 500);
  const video = text ? parseYouTubeUrl(text) : null;
  if (text && !video) {
    return { ok: false, error: "This is not a YouTube video link. Paste a link like https://www.youtube.com/watch?v=… , https://youtu.be/… or https://youtube.com/shorts/…" };
  }
  const product = await prisma.product.findUnique({ where: { id }, select: { youtubeUrl: true, youtubeAddedAt: true } });
  if (!product) return { ok: false, error: "This product no longer exists." };
  const url = video ? normalisedYouTubeUrl(video) : null;
  await prisma.product.update({
    where: { id },
    data: {
      youtubeUrl: url,
      youtubeVideoPosition: toVideoPosition(position),
      youtubeVideoFirst: toVideoPosition(position) === "FIRST", // kept in step with the position
      // The date is kept while the same video stays, so Google sees a stable upload date.
      youtubeAddedAt: url ? (url === product.youtubeUrl && product.youtubeAddedAt ? product.youtubeAddedAt : new Date()) : null,
    },
  });
  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true, url };
}
