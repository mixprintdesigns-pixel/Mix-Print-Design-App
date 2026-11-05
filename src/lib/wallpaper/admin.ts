import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { toSlug } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { checkImage } from "@/lib/storage/images";
import { descriptiveKey } from "@/lib/storage/webp";
import { WATERMARK_PNG_BASE64 } from "./watermark-icon";

// Admin → 3D Wallpaper Gallery. Only small preview images are stored (WebP, at most 1500 px, with a light
// Mix Print watermark). The big print PDFs stay on Google Drive: only their link is kept, shown in Admin only.

const MAX_PX = 1500;
const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

/** Resizes to WebP (≤ 1500 px) and adds the semi-transparent Mix Print icon in the middle. */
export async function watermarkedPreview(bytes: Uint8Array): Promise<Buffer> {
  const check = checkImage(bytes);
  if (!check.ok) throw new AdminInputError(check.error);
  const base = sharp(bytes, { failOn: "none" }).rotate().resize({ width: MAX_PX, height: MAX_PX, fit: "inside", withoutEnlargement: true });
  const { data, info } = await base.toBuffer({ resolveWithObject: true });
  const markWidth = Math.max(80, Math.round(Math.min(info.width, info.height) * 0.28));
  const mark = await sharp(Buffer.from(WATERMARK_PNG_BASE64, "base64"))
    .resize({ width: markWidth })
    .ensureAlpha()
    .composite([{ input: Buffer.from([255, 255, 255, Math.round(255 * 0.3)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(data).composite([{ input: mark, gravity: "center" }]).webp({ quality: 80 }).toBuffer();
}

export async function listWallpaperAdmin() {
  const [categories, designs] = await Promise.all([
    prisma.wallpaperCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { designs: true } } } }),
    prisma.wallpaperDesign.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
  ]);
  return { categories, designs: designs.map((d) => ({ ...d, extraImages: extraImages(d.extraImages) })) };
}

function extraImages(value: unknown): { url: string; key: string }[] {
  return Array.isArray(value) ? (value as { url?: string; key?: string }[]).filter((x) => typeof x?.url === "string" && typeof x?.key === "string").map((x) => ({ url: x.url!, key: x.key! })) : [];
}

/** The next free design code: WP-001, WP-002… */
export async function nextDesignCode(): Promise<string> {
  const codes = await prisma.wallpaperDesign.findMany({ select: { code: true } });
  const max = Math.max(0, ...codes.map((c) => Number(/^WP-(\d+)$/i.exec(c.code)?.[1] ?? 0)));
  return `WP-${String(max + 1).padStart(3, "0")}`;
}

function normaliseCode(text: string): string {
  const code = text.trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) throw new AdminInputError("Design code: letters, numbers and dashes only, e.g. WP-012.");
  return code;
}

function driveLink(text: string): string | null {
  const url = text.trim();
  if (!url) return null;
  if (!/^https:\/\/\S+$/i.test(url)) throw new AdminInputError("File link: paste the full https:// link (e.g. from Google Drive).");
  return url.slice(0, 1000);
}

// ─── Categories ──────────────────────────────────────────────────────────────

/** Saves the categories list: rows c_id_i… (existing) and a new one (new_name). Delete keeps the designs (uncategorised). */
export async function saveWallpaperCategories(data: FormData) {
  const count = Math.min(Number.parseInt(clean(data.get("c_count"), 4), 10) || 0, 200);
  for (let i = 0; i < count; i++) {
    const id = clean(data.get(`c_id_${i}`), 50);
    if (!id) continue;
    if (data.get(`c_del_${i}`) === "on") {
      await prisma.wallpaperCategory.delete({ where: { id } });
      continue;
    }
    const name = clean(data.get(`c_name_${i}`), 80);
    const slug = toSlug(clean(data.get(`c_slug_${i}`), 80) || name);
    if (!name || !slug) throw new AdminInputError("Every category needs a name.");
    if (await prisma.wallpaperCategory.findFirst({ where: { slug, id: { not: id } } })) throw new AdminInputError(`Another category already uses the address “${slug}”.`);
    await prisma.wallpaperCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description: clean(data.get(`c_desc_${i}`), 500) || null,
        seoTitle: clean(data.get(`c_seot_${i}`), 70) || null,
        seoDescription: clean(data.get(`c_seod_${i}`), 170) || null,
        sortOrder: Number.parseInt(clean(data.get(`c_order_${i}`), 6), 10) || 0,
        isVisible: data.get(`c_on_${i}`) === "on",
      },
    });
  }
  const newName = clean(data.get("new_name"), 80);
  if (newName) {
    const slug = toSlug(newName);
    if (await prisma.wallpaperCategory.findUnique({ where: { slug } })) throw new AdminInputError(`“${newName}” already exists.`);
    const last = await prisma.wallpaperCategory.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await prisma.wallpaperCategory.create({ data: { name: newName, slug, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  }
}

// ─── Designs ─────────────────────────────────────────────────────────────────

export async function addWallpaperDesign(data: FormData, bytes: Uint8Array) {
  const title = clean(data.get("title"), 120);
  if (title.length < 2) throw new AdminInputError("Enter the design title.");
  const code = clean(data.get("code"), 20) ? normaliseCode(clean(data.get("code"), 20)) : await nextDesignCode();
  if (await prisma.wallpaperDesign.findUnique({ where: { code } })) throw new AdminInputError(`The code ${code} is already used.`);
  const categoryId = clean(data.get("categoryId"), 50) || null;
  const preview = await watermarkedPreview(bytes);
  const stored = await saveFile(descriptiveKey("wallpaper", `${code} ${title}`, "webp"), preview, "image/webp");
  const last = await prisma.wallpaperDesign.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await prisma.wallpaperDesign.create({
    data: { code, title, categoryId, imageUrl: stored.url, imageKey: stored.key, driveUrl: driveLink(clean(data.get("driveUrl"), 1000)), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return code;
}

export async function saveWallpaperDesign(id: string, data: FormData) {
  const title = clean(data.get("title"), 120);
  if (title.length < 2) throw new AdminInputError("Enter the design title.");
  const code = normaliseCode(clean(data.get("code"), 20));
  if (await prisma.wallpaperDesign.findFirst({ where: { code, id: { not: id } } })) throw new AdminInputError(`The code ${code} is already used.`);
  await prisma.wallpaperDesign.update({
    where: { id },
    data: {
      code,
      title,
      categoryId: clean(data.get("categoryId"), 50) || null,
      driveUrl: driveLink(clean(data.get("driveUrl"), 1000)),
      sortOrder: Number.parseInt(clean(data.get("sortOrder"), 6), 10) || 0,
      isVisible: data.get("isVisible") === "on",
    },
  });
}

export async function deleteWallpaperDesign(id: string) {
  const design = await prisma.wallpaperDesign.delete({ where: { id } });
  for (const key of [design.imageKey, ...extraImages(design.extraImages).map((x) => x.key)]) await deleteFile(key).catch(() => {});
}

export async function addWallpaperExtraImage(id: string, bytes: Uint8Array) {
  const design = await prisma.wallpaperDesign.findUnique({ where: { id } });
  if (!design) throw new AdminInputError("This design no longer exists.");
  const extras = extraImages(design.extraImages);
  if (extras.length >= 8) throw new AdminInputError("Up to 8 extra previews per design.");
  const stored = await saveFile(descriptiveKey("wallpaper", `${design.code} ${design.title} ${extras.length + 2}`, "webp"), await watermarkedPreview(bytes), "image/webp");
  await prisma.wallpaperDesign.update({ where: { id }, data: { extraImages: [...extras, { url: stored.url, key: stored.key }] } });
}

export async function removeWallpaperExtraImage(id: string, key: string) {
  const design = await prisma.wallpaperDesign.findUnique({ where: { id } });
  if (!design) return;
  await prisma.wallpaperDesign.update({ where: { id }, data: { extraImages: extraImages(design.extraImages).filter((x) => x.key !== key) } });
  await deleteFile(key).catch(() => {});
}
