import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { ancestry, findByPath, type CategoryNode } from "@/lib/catalog/tree";

// 3D Wallpaper gallery (Admin → 3D Wallpaper Gallery). The website only ever reads the small preview images:
// the Google Drive link to the print PDF is for Admin and is never selected here.

export const WALLPAPER_TAG = "wallpaper";
export const WALLPAPER_SLUG = "3d-wallpaper";

/** True for the 3D Wallpaper page under Digital Printing. */
export function isWallpaperService(tree: CategoryNode[], node: CategoryNode): boolean {
  return node.slug === WALLPAPER_SLUG && ancestry(tree, node)[0]?.slug === "digital-printing";
}

export type PublicWallpaperCategory = { id: string; name: string; slug: string; description: string | null; seoTitle: string | null; seoDescription: string | null };
export type PublicWallpaperDesign = { id: string; code: string; title: string; categoryId: string | null; imageUrl: string; extraImages: string[] };
export type PublicWallpaperGallery = { categories: PublicWallpaperCategory[]; designs: PublicWallpaperDesign[] };

export async function getWallpaperGallery(): Promise<PublicWallpaperGallery> {
  "use cache";
  cacheTag(WALLPAPER_TAG);
  cacheLife("hours");
  const [categories, designs] = await Promise.all([
    prisma.wallpaperCategory.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, description: true, seoTitle: true, seoDescription: true },
    }),
    prisma.wallpaperDesign.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, title: true, categoryId: true, imageUrl: true, extraImages: true },
    }),
  ]);
  const visibleCats = new Set(categories.map((c) => c.id));
  return {
    categories,
    designs: designs.map((d) => ({
      ...d,
      categoryId: d.categoryId && visibleCats.has(d.categoryId) ? d.categoryId : null,
      extraImages: Array.isArray(d.extraImages) ? (d.extraImages as { url?: string }[]).map((x) => x?.url).filter((u): u is string => typeof u === "string") : [],
    })),
  };
}

/** /services/digital-printing/3d-wallpaper/<gallery category>: the 3D Wallpaper page and that gallery category. */
export async function findWallpaperCategoryPage(tree: CategoryNode[], path: string[]) {
  if (path.length < 2) return null;
  const service = findByPath(tree, path.slice(0, -1));
  if (!service || !isWallpaperService(tree, service)) return null;
  const category = (await getWallpaperGallery()).categories.find((c) => c.slug === path.at(-1));
  return category ? { service, category } : null;
}
