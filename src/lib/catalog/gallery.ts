import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "./queries";

export type GalleryImage = { id: string; url: string; alt: string | null };

/** A category's extra images (Admin → Categories & Services → Edit all settings → Images), in order. */
export async function getCategoryGallery(categoryId: string): Promise<GalleryImage[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return prisma.categoryImage.findMany({ where: { categoryId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, url: true, alt: true } });
}
