import "server-only";
import { prisma } from "@/lib/db";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { categoryChoices } from "@/lib/admin/editor-data";
import { toSlug } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";
import { parseRupees } from "@/lib/admin/product-input";
import { DEFAULT_RATE_SETTINGS, itemSelect, readRateSettings } from "./queries";
import type { RateVariantType } from "./visibility";

// Admin → Rates: everything about the rate pages is managed here. Nothing is ever deleted: items and variants
// are hidden instead, and a rate of 0 also keeps them off the website.

/** Rate pages can be placed on these main services (and any page inside them). */
export const RATE_SERVICE_ROOTS = ["board-maker", "digital-printing"];

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const optional = (v: FormDataEntryValue | null, max: number) => clean(v, max) || null;

function rupees(v: FormDataEntryValue | null, label: string): number {
  const text = String(v ?? "").trim();
  const minor = text === "" ? 0 : parseRupees(text);
  if (minor === null) throw new AdminInputError(`${label}: enter an amount in rupees, e.g. 45 or 45.50.`);
  return minor;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Service pages a rate page can go on: inside Sign Board Maker or Digital Printing. */
export async function rateServiceChoices() {
  const all = await categoryChoices();
  const roots = new Set(all.filter((c) => c.depth === 0 && RATE_SERVICE_ROOTS.includes(c.slug)).map((c) => c.id));
  return all.filter((c) => roots.has(c.rootId));
}

export async function listRatePages() {
  const [pages, choices] = await Promise.all([
    prisma.ratePage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, isVisible: true, categoryId: true, items: { select: itemSelect } },
    }),
    rateServiceChoices(),
  ]);
  return pages.map((p) => {
    const category = choices.find((c) => c.id === p.categoryId);
    return { ...p, category: category ? { name: category.name, path: category.path, isVisible: category.isVisible } : null };
  });
}

export async function getRatePageForAdmin(id: string) {
  const page = await prisma.ratePage.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      intro: true,
      seoTitle: true,
      seoDescription: true,
      isVisible: true,
      sortOrder: true,
      categoryId: true,
      items: { select: { ...itemSelect, imageKey: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!page) return null;
  const choices = await rateServiceChoices();
  const category = choices.find((c) => c.id === page.categoryId) ?? null;
  return { ...page, category };
}

export { readRateSettings };

// ─── Settings ────────────────────────────────────────────────────────────────

export async function saveRateSettings(data: FormData) {
  const designChargeMinor = rupees(data.get("designCharge"), "Design charges");
  const minText = clean(data.get("minOrder"), 20);
  const minOrderMinor = minText ? rupees(minText, "Minimum order") : null;
  const gsmOptions = [...new Set(clean(data.get("gsmOptions"), 500).split(/[,\s]+/).filter(Boolean).map(Number))];
  if (gsmOptions.some((g) => !Number.isInteger(g) || g < 1 || g > 2000)) throw new AdminInputError("GSM options: whole numbers separated by commas, e.g. 200, 220, 240.");
  const seriesOptions = [...new Set(clean(data.get("seriesOptions"), 1000).split(/\n|,/).map((s) => s.trim().slice(0, 60)).filter(Boolean))];
  const values = {
    designChargeMinor,
    minOrderMinor: minOrderMinor || null,
    gsmOptions: gsmOptions.length ? gsmOptions.sort((a, b) => a - b) : DEFAULT_RATE_SETTINGS.gsmOptions,
    seriesOptions: seriesOptions.length ? seriesOptions : DEFAULT_RATE_SETTINGS.seriesOptions,
  };
  await prisma.rateSettings.upsert({ where: { id: "default" }, create: { id: "default", ...values }, update: values });
}

// ─── Pages ───────────────────────────────────────────────────────────────────

/** Puts a new rate page on an existing service page, or on a new board type created under Sign Board Maker. */
export async function createRatePage(data: FormData): Promise<{ id: string; createdCategory: boolean }> {
  const choices = await rateServiceChoices();
  let categoryId = clean(data.get("categoryId"), 50);
  const newBoard = clean(data.get("newBoardName"), 100);
  let createdCategory = false;

  if (newBoard) {
    const board = choices.find((c) => c.depth === 0 && c.slug === "board-maker");
    if (!board) throw new AdminInputError("The Sign Board Maker service was not found.");
    const slug = toSlug(newBoard);
    if (!slug) throw new AdminInputError("Enter a name for the new board type.");
    if (await prisma.category.findFirst({ where: { parentId: board.id, slug } })) {
      throw new AdminInputError(`“${newBoard}” already exists under Sign Board Maker: choose it from the list instead.`);
    }
    const last = await prisma.category.findFirst({ where: { parentId: board.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const category = await prisma.category.create({
      data: { name: newBoard, slug, parentId: board.id, sortOrder: (last?.sortOrder ?? 0) + 1, priceUnit: "per sq. ft" },
    });
    categoryId = category.id;
    createdCategory = true;
  } else {
    if (!choices.some((c) => c.id === categoryId)) throw new AdminInputError("Choose the service page, or type the name of a new board type.");
    if (await prisma.ratePage.findUnique({ where: { categoryId } })) throw new AdminInputError("That service page already has rates: open it from the list.");
  }

  const name = choices.find((c) => c.id === categoryId)?.name ?? newBoard;
  const title = clean(data.get("title"), 160) || `${name} Price per Sq Ft in Lahore`;
  const count = await prisma.ratePage.count();
  const page = await prisma.ratePage.create({ data: { categoryId, title, sortOrder: count } });
  return { id: page.id, createdCategory };
}

export async function saveRatePage(id: string, data: FormData) {
  const title = clean(data.get("title"), 160);
  if (title.length < 3) throw new AdminInputError("Enter the page title (H1).");
  await prisma.ratePage.update({
    where: { id },
    data: {
      title,
      intro: optional(data.get("intro"), 1000),
      seoTitle: optional(data.get("seoTitle"), 70),
      seoDescription: optional(data.get("seoDescription"), 170),
      isVisible: data.get("isVisible") === "on",
      sortOrder: Number.parseInt(clean(data.get("sortOrder"), 6), 10) || 0,
    },
  });
}

// ─── Items ───────────────────────────────────────────────────────────────────

const VARIANT_TYPES: RateVariantType[] = ["NONE", "GSM", "SERIES"];
const variantType = (v: FormDataEntryValue | null): RateVariantType => (VARIANT_TYPES.includes(String(v) as RateVariantType) ? (String(v) as RateVariantType) : "NONE");

export async function addRateItem(pageId: string, data: FormData): Promise<string> {
  const name = clean(data.get("name"), 120);
  if (name.length < 2) throw new AdminInputError("Enter the item name.");
  const last = await prisma.rateItem.findFirst({ where: { pageId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const item = await prisma.rateItem.create({
    data: {
      pageId,
      name,
      section: optional(data.get("section"), 60),
      subtitle: optional(data.get("subtitle"), 80),
      variantType: variantType(data.get("variantType")),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return item.id;
}

/**
 * Saves an item and its variants. The form sends one row per GSM / series option (v_label_i, v_rate_i, v_on_i).
 * Variants are updated or added, never deleted; ones not in the form are hidden.
 */
export async function saveRateItem(itemId: string, data: FormData) {
  const name = clean(data.get("name"), 120);
  if (name.length < 2) throw new AdminInputError("Enter the item name.");
  const type = variantType(data.get("variantType"));
  const rateMinor = type === "NONE" ? rupees(data.get("rate"), "Rate per sq ft") : undefined;

  const rows: { label: string; rateMinor: number; isVisible: boolean; sortOrder: number }[] = [];
  const count = Math.min(Number.parseInt(clean(data.get("v_count"), 4), 10) || 0, 100);
  if (type !== "NONE") {
    for (let i = 0; i < count; i++) {
      const label = clean(data.get(`v_label_${i}`), 60);
      if (!label) continue;
      rows.push({ label, rateMinor: rupees(data.get(`v_rate_${i}`), label), isVisible: data.get(`v_on_${i}`) === "on", sortOrder: i });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.rateItem.update({
      where: { id: itemId },
      data: {
        name,
        section: optional(data.get("section"), 60),
        subtitle: optional(data.get("subtitle"), 80),
        description: optional(data.get("description"), 5000),
        imageAlt: optional(data.get("imageAlt"), 200),
        variantType: type,
        ...(rateMinor !== undefined ? { rateMinor } : {}),
        isVisible: data.get("isVisible") === "on",
        sortOrder: Number.parseInt(clean(data.get("sortOrder"), 6), 10) || 0,
      },
    });
    for (const row of rows) {
      await tx.rateVariant.upsert({ where: { itemId_label: { itemId, label: row.label } }, create: { itemId, ...row }, update: row });
    }
    await tx.rateVariant.updateMany({ where: { itemId, label: { notIn: rows.map((r) => r.label) } }, data: { isVisible: false } });
  });
}

export async function setRateItemImage(itemId: string, bytes: Uint8Array, alt?: string) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { name: true, imageKey: true, imageAlt: true } });
  if (!item) throw new AdminInputError("This item no longer exists.");
  const image = await toWebp(bytes, 1200);
  if (!image.ok) throw new AdminInputError(image.error);
  const stored = await saveFile(descriptiveKey("rates", item.name, image.ext), image.bytes, image.type);
  await prisma.rateItem.update({ where: { id: itemId }, data: { imageUrl: stored.url, imageKey: stored.key, imageAlt: alt?.trim().slice(0, 200) || item.imageAlt || item.name } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}

export async function removeRateItemImage(itemId: string) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { imageKey: true } });
  if (!item) return;
  await prisma.rateItem.update({ where: { id: itemId }, data: { imageUrl: null, imageKey: null } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}

/** The variant rows the item form shows: every GSM / series option from the settings, plus any older ones. */
export function variantRows(
  type: RateVariantType,
  settings: { gsmOptions: number[]; seriesOptions: string[] },
  existing: { label: string; rateMinor: number; isVisible: boolean }[],
) {
  if (type === "NONE") return [];
  const labels = type === "GSM" ? settings.gsmOptions.map((g) => `${g} GSM`) : settings.seriesOptions;
  const extra = existing.filter((v) => !labels.includes(v.label) && (type === "GSM" ? /GSM$/.test(v.label) : !/GSM$/.test(v.label))).map((v) => v.label);
  return [...labels, ...extra].map((label) => {
    const v = existing.find((e) => e.label === label);
    return { label, rateMinor: v?.rateMinor ?? 0, isVisible: v ? v.isVisible : true };
  });
}
