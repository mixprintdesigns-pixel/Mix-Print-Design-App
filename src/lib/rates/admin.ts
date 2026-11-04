import "server-only";
import { prisma } from "@/lib/db";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { categoryChoices } from "@/lib/admin/editor-data";
import { toSlug } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";
import { parseRupees } from "@/lib/admin/product-input";
import { itemSelect, readRateFeatures, readRateSettings } from "./queries";
import { publicSections, type RateSectionKind } from "./visibility";

// Admin → Rates: everything about the rate pages is managed here: pages (one per service page), their sections
// (blue title bar + pricing rule), the button rows / sticker types / sign board qualities in each section, every
// button and rate, the features list and the designing charges. Rate 0 or "hidden" keeps anything off the website;
// the owner can also delete sections, rows and buttons (with a confirmation).

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
  const [pages, choices, features] = await Promise.all([
    prisma.ratePage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, isVisible: true, categoryId: true, sections: { select: { id: true, title: true, kind: true, isVisible: true, sortOrder: true, items: { select: itemSelect } } } },
    }),
    rateServiceChoices(),
    readRateFeatures(),
  ]);
  return pages.map((p) => {
    const category = choices.find((c) => c.id === p.categoryId);
    return {
      id: p.id,
      title: p.title,
      isVisible: p.isVisible,
      categoryId: p.categoryId,
      sectionCount: p.sections.length,
      liveSections: p.isVisible ? publicSections(p.sections, features).length : 0,
      category: category ? { name: category.name, path: category.path, isVisible: category.isVisible } : null,
    };
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
      sections: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          kind: true,
          isVisible: true,
          sortOrder: true,
          items: { select: { ...itemSelect, imageKey: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!page) return null;
  const choices = await rateServiceChoices();
  const category = choices.find((c) => c.id === page.categoryId) ?? null;
  return { ...page, category };
}

export { readRateSettings, readRateFeatures };

// ─── Settings and the features list ──────────────────────────────────────────

export async function saveRateSettings(data: FormData) {
  const designChargeMinor = rupees(data.get("designCharge"), "Designing charges");
  const minText = clean(data.get("minOrder"), 20);
  const minOrderMinor = minText ? rupees(minText, "Minimum order") : null;
  const values = { designChargeMinor, minOrderMinor: minOrderMinor || null };
  await prisma.rateSettings.upsert({ where: { id: "default" }, create: { id: "default", ...values }, update: values });
}

/**
 * Saves the master features list. Rows: f_id_i, f_label_i, f_order_i, f_on_i, f_del_i (existing) and
 * f_new_i (new labels). A deleted feature is also unticked on every quality.
 */
export async function saveRateFeatures(data: FormData) {
  const count = Math.min(Number.parseInt(clean(data.get("f_count"), 4), 10) || 0, 200);
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const id = clean(data.get(`f_id_${i}`), 50);
      if (!id) continue;
      if (data.get(`f_del_${i}`) === "on") {
        await tx.rateFeature.delete({ where: { id } });
        await tx.$executeRaw`UPDATE "RateItem" SET "featureIds" = array_remove("featureIds", ${id}) WHERE ${id} = ANY("featureIds")`;
        continue;
      }
      const label = clean(data.get(`f_label_${i}`), 80);
      if (!label) throw new AdminInputError("A feature cannot be empty: tick Delete to remove it.");
      await tx.rateFeature.update({ where: { id }, data: { label, sortOrder: order(data.get(`f_order_${i}`)), isVisible: data.get(`f_on_${i}`) === "on" } });
    }
    const last = await tx.rateFeature.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    let next = (last?.sortOrder ?? -1) + 1;
    for (const label of data.getAll("f_new").map((v) => clean(v, 80)).filter(Boolean)) {
      await tx.rateFeature.create({ data: { label, sortOrder: next++ } });
    }
  });
}

const order = (v: FormDataEntryValue | null) => Number.parseInt(clean(v, 6), 10) || 0;

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

  const chosen = choices.find((c) => c.id === categoryId);
  const name = chosen?.name ?? newBoard;
  const isBoard = createdCategory || choices.find((c) => c.id === chosen?.rootId)?.slug === "board-maker";
  const title = clean(data.get("title"), 160) || `${name} Price per Sq Ft in Lahore`;
  const count = await prisma.ratePage.count();
  const page = await prisma.ratePage.create({
    data: {
      categoryId,
      title,
      sortOrder: count,
      // Sign boards start with their section, ready for qualities
      ...(isBoard ? { sections: { create: { title: `${name} Rate per sq ft (Rs)`, kind: "SIGN_BOARD" } } } : {}),
    },
  });
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
      sortOrder: order(data.get("sortOrder")),
    },
  });
}

// ─── Sections ────────────────────────────────────────────────────────────────

const KINDS: RateSectionKind[] = ["FLEX", "STICKER", "SIGN_BOARD"];
function kind(v: FormDataEntryValue | null): RateSectionKind {
  const k = String(v ?? "") as RateSectionKind;
  if (!KINDS.includes(k)) throw new AdminInputError("Choose the pricing rule: Flex, Sticker or Sign Board.");
  return k;
}
const variantTypeFor = (k: RateSectionKind) => (k === "FLEX" ? "GSM" : k === "STICKER" ? "SERIES" : "NONE");

export async function addRateSection(pageId: string, data: FormData) {
  const title = clean(data.get("title"), 120);
  if (title.length < 3) throw new AdminInputError("Enter the section title, e.g. Flex GSM & Rate per sq ft (Rs).");
  const last = await prisma.rateSection.findFirst({ where: { pageId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await prisma.rateSection.create({ data: { pageId, title, kind: kind(data.get("kind")), sortOrder: (last?.sortOrder ?? -1) + 1 } });
}

export async function saveRateSection(id: string, data: FormData) {
  const title = clean(data.get("title"), 120);
  if (title.length < 3) throw new AdminInputError("Enter the section title.");
  const k = kind(data.get("kind"));
  await prisma.$transaction([
    prisma.rateSection.update({ where: { id }, data: { title, kind: k, sortOrder: order(data.get("sortOrder")), isVisible: data.get("isVisible") === "on" } }),
    prisma.rateItem.updateMany({ where: { sectionId: id }, data: { variantType: variantTypeFor(k) } }),
  ]);
}

/** Deletes a section with its rows / qualities and buttons (the owner confirms first). */
export async function deleteRateSection(id: string) {
  await prisma.$transaction(async (tx) => {
    const items = await tx.rateItem.findMany({ where: { sectionId: id }, select: { id: true, imageKey: true } });
    await tx.rateVariant.deleteMany({ where: { itemId: { in: items.map((i) => i.id) } } });
    await tx.rateItem.deleteMany({ where: { sectionId: id } });
    await tx.rateSection.delete({ where: { id } });
    for (const i of items) if (i.imageKey) await deleteFile(i.imageKey).catch(() => {});
  });
}

// ─── Rows, sticker types and qualities (RateItem) and their buttons ──────────

export async function addRateGroup(sectionId: string, data: FormData): Promise<string> {
  const name = clean(data.get("name"), 120);
  if (name.length < 2) throw new AdminInputError("Enter the name.");
  const section = await prisma.rateSection.findUnique({ where: { id: sectionId }, select: { pageId: true, kind: true } });
  if (!section) throw new AdminInputError("This section no longer exists.");
  const last = await prisma.rateItem.findFirst({ where: { sectionId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const item = await prisma.rateItem.create({
    data: {
      pageId: section.pageId,
      sectionId,
      name,
      subtitle: optional(data.get("subtitle"), 80),
      variantType: variantTypeFor(section.kind),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return item.id;
}

/**
 * Saves a row / sticker type / quality. Sign board qualities: rate, ticked features (feature_<id>), description.
 * Flex and sticker rows: their buttons, sent as b_id_i, b_label_i, b_rate_i, b_order_i, b_on_i, b_del_i
 * (b_count rows; a row without an id is a new button).
 */
export async function saveRateGroup(itemId: string, data: FormData) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { rateSection: { select: { kind: true } } } });
  if (!item?.rateSection) throw new AdminInputError("This item no longer exists.");
  const sectionKind = item.rateSection.kind;
  const name = clean(data.get("name"), 120);
  if (name.length < 2) throw new AdminInputError("Enter the name.");

  type Row = { id: string; label: string; rateMinor: number; isVisible: boolean; sortOrder: number; remove: boolean };
  const rows: Row[] = [];
  if (sectionKind !== "SIGN_BOARD") {
    const count = Math.min(Number.parseInt(clean(data.get("b_count"), 4), 10) || 0, 200);
    for (let i = 0; i < count; i++) {
      const id = clean(data.get(`b_id_${i}`), 50);
      const label = clean(data.get(`b_label_${i}`), 60);
      const remove = data.get(`b_del_${i}`) === "on";
      if (!label && !id) continue; // an unused new row
      if (!label && !remove) throw new AdminInputError("Every button needs its text (e.g. 240 GSM): tick Delete to remove one.");
      rows.push({ id, label, rateMinor: remove ? 0 : rupees(data.get(`b_rate_${i}`), label || "Rate"), isVisible: data.get(`b_on_${i}`) === "on", sortOrder: order(data.get(`b_order_${i}`)), remove });
    }
    const labels = rows.filter((r) => !r.remove).map((r) => r.label.toLowerCase());
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    if (dup) throw new AdminInputError(`Two buttons have the same text (“${dup}”): change one of them.`);
  }

  const features = await readRateFeatures();
  await prisma.$transaction(async (tx) => {
    await tx.rateItem.update({
      where: { id: itemId },
      data: {
        name,
        subtitle: optional(data.get("subtitle"), 80),
        description: optional(data.get("description"), 5000),
        imageAlt: optional(data.get("imageAlt"), 200),
        isVisible: data.get("isVisible") === "on",
        sortOrder: order(data.get("sortOrder")),
        variantType: variantTypeFor(sectionKind),
        ...(sectionKind === "SIGN_BOARD"
          ? { rateMinor: rupees(data.get("rate"), "Rate per sq ft"), featureIds: features.filter((f) => data.get(`feature_${f.id}`) === "on").map((f) => f.id) }
          : {}),
      },
    });
    // Deletes first, so a deleted button's text can be reused straight away
    const removeIds = rows.filter((r) => r.remove && r.id).map((r) => r.id);
    if (removeIds.length) await tx.rateVariant.deleteMany({ where: { itemId, id: { in: removeIds } } });
    for (const r of rows.filter((x) => !x.remove)) {
      const values = { label: r.label, rateMinor: r.rateMinor, isVisible: r.isVisible, sortOrder: r.sortOrder };
      if (r.id) await tx.rateVariant.update({ where: { id: r.id, itemId }, data: values });
      else await tx.rateVariant.create({ data: { itemId, ...values } });
    }
  });
}

/** Deletes a row / sticker type / quality and its buttons (the owner confirms first). */
export async function deleteRateGroup(itemId: string) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { imageKey: true } });
  if (!item) return;
  await prisma.$transaction([prisma.rateVariant.deleteMany({ where: { itemId } }), prisma.rateItem.delete({ where: { id: itemId } })]);
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
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
