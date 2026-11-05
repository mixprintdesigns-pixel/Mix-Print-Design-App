import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AdminInputError, saveCategory } from "@/lib/admin/catalog-service";
import { categoryChoices } from "@/lib/admin/editor-data";
import { categoryInputSchema, parseRupees } from "@/lib/admin/product-input";
import { defaultCategoryTitle, metaDescription } from "@/lib/catalog/tree";
import { parseBonusSlabs } from "@/lib/rates/calculator";
import { deleteFile, saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";

// Admin → Categories & Services → "Edit all settings": one page and one Save for a category: basic info, images,
// rates & calculator (sections, buttons, rates, pricing rules), affiliate commission, the features list and SEO.
// Saving only writes what changed. An empty rate box keeps the saved rate, so a save can never wipe rates.

/** The per-sq-ft calculator is only for these main services (and every page inside them). */
export const RATE_ROOTS = ["digital-printing", "board-maker"];
const KINDS = ["FLEX", "STICKER", "SIGN_BOARD"] as const;
type Kind = (typeof KINDS)[number];

const paisa = (minor: number | null | undefined) => (minor == null ? "" : minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function getCategoryFullData(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      content: true,
      parentId: true,
      sortOrder: true,
      isVisible: true,
      priceFromMinor: true,
      priceUnit: true,
      imageUrl: true,
      imageAlt: true,
      seoTitle: true,
      seoDescription: true,
      focusKeyword: true,
      ogImageUrl: true,
      gallery: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, url: true, alt: true, sortOrder: true } },
      ratePage: {
        select: {
          id: true,
          title: true,
          intro: true,
          isVisible: true,
          seoTitle: true,
          seoDescription: true,
          sections: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              kind: true,
              isVisible: true,
              sortOrder: true,
              commissionPerSqftMinor: true,
              bonusSlabs: true,
              fittingRateMinor: true,
              askDesignCode: true,
              showOnCategoryIds: true,
              items: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  name: true,
                  subtitle: true,
                  description: true,
                  imageAlt: true,
                  imageUrl: true,
                  rateMinor: true,
                  isVisible: true,
                  sortOrder: true,
                  featureIds: true,
                  variants: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true, rateMinor: true, rule: true, isVisible: true, sortOrder: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!category) return null;

  const all = await categoryChoices();
  const me = all.find((c) => c.id === id)!;
  const root = all.find((c) => c.id === me.rootId);
  const rateEnabled = !!root && RATE_ROOTS.includes(root.slug);
  const chain: typeof all = [];
  for (let cur: (typeof all)[number] | undefined = me; cur; cur = all.find((c) => c.id === cur!.parentId)) chain.unshift(cur);
  const rateChoices = all.filter((c) => root && c.rootId === root.id).map((c) => ({ id: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }));

  // Sections of other pages shown here (e.g. the Flex section of Digital Printing on China Flex)
  const chainIds = chain.map((c) => c.id);
  const linked = rateEnabled
    ? await prisma.rateSection.findMany({
        where: { showOnCategoryIds: { hasSome: chainIds }, page: { categoryId: { not: id } } },
        select: { id: true, title: true, page: { select: { categoryId: true } } },
      })
    : [];
  const features = await prisma.rateFeature.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, label: true, isVisible: true, sortOrder: true } });

  const page = category.ratePage;
  const editable = {
    category: {
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      content: category.content ?? "",
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      priceFrom: paisa(category.priceFromMinor),
      priceUnit: category.priceUnit ?? "",
      imageAlt: category.imageAlt ?? "",
      seoTitle: page?.seoTitle || category.seoTitle || "",
      seoDescription: page?.seoDescription || category.seoDescription || "",
      focusKeyword: category.focusKeyword ?? "",
    },
    rates: rateEnabled
      ? {
          enabled: page?.isVisible ?? true,
          title: page?.title ?? `${category.name} Price per Sq Ft in Lahore`,
          intro: page?.intro ?? "",
          sections: (page?.sections ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            kind: s.kind as Kind,
            isVisible: s.isVisible,
            sortOrder: s.sortOrder,
            remove: false,
            commission: paisa(s.commissionPerSqftMinor),
            bonusSlabs: parseBonusSlabs(s.bonusSlabs).map((b) => ({ minSqft: String(b.minSqft), bonus: paisa(b.bonusMinor) })),
            hasFitting: s.fittingRateMinor != null,
            fittingRate: paisa(s.fittingRateMinor ?? 0),
            askDesignCode: s.askDesignCode,
            showOn: s.showOnCategoryIds,
            groups: s.items.map((g) => ({
              id: g.id,
              name: g.name,
              subtitle: g.subtitle ?? "",
              description: g.description ?? "",
              imageAlt: g.imageAlt ?? "",
              rate: paisa(g.rateMinor),
              isVisible: g.isVisible,
              sortOrder: g.sortOrder,
              featureIds: g.featureIds,
              remove: false,
              buttons: g.variants.map((v) => ({ id: v.id, label: v.label, rate: paisa(v.rateMinor), rule: (v.rule as Kind | null) ?? null, isVisible: v.isVisible, sortOrder: v.sortOrder, remove: false })),
            })),
          })),
        }
      : null,
    features: rateEnabled ? features.map((f) => ({ id: f.id, label: f.label, isVisible: f.isVisible, sortOrder: f.sortOrder, remove: false })) : null,
    gallery: category.gallery.map((g) => ({ id: g.id, alt: g.alt ?? "", sortOrder: g.sortOrder, remove: false })),
  };
  return {
    id: category.id,
    parentId: category.parentId,
    path: chain.map((c) => c.slug),
    trail: chain.map((c) => c.name),
    rateEnabled,
    rateChoices,
    /** Sign board quality images (uploaded at once, like the other images). */
    qualityImages: Object.fromEntries((page?.sections ?? []).flatMap((s) => s.items.map((i) => [i.id, i.imageUrl] as const))),
    linked: linked.map((l) => ({ id: l.id, title: l.title, categoryId: l.page.categoryId, owner: all.find((c) => c.id === l.page.categoryId)?.name ?? "" })),
    images: { coverUrl: category.imageUrl, ogImageUrl: category.ogImageUrl, gallery: category.gallery.map((g) => ({ id: g.id, url: g.url, alt: g.alt ?? "", sortOrder: g.sortOrder })) },
    seoDefaults: {
      title: defaultCategoryTitle({ name: category.name, path: chain.map((c) => c.slug) }, chain.slice(0, -1)),
      description: metaDescription(category.description || category.content) ?? "",
    },
    editable,
    /** Changes whenever the saved data changes, so the editor starts afresh after a save. Images are left out,
     *  so uploading an image never throws away unsaved edits. */
    version: createHash("md5").update(JSON.stringify({ ...editable, gallery: null })).digest("hex"),
  };
}

export type CategoryFullData = NonNullable<Awaited<ReturnType<typeof getCategoryFullData>>>;
export type CategoryFullPayload = CategoryFullData["editable"];

// ─── Saving ──────────────────────────────────────────────────────────────────

const money = z.string().trim().max(20);
const kind = z.enum(KINDS);
const optionalId = z.string().max(200).optional();
const payloadSchema = z.object({
  category: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    content: z.string(),
    sortOrder: z.coerce.number().int(),
    isVisible: z.boolean(),
    priceFrom: z.string(),
    priceUnit: z.string(),
    imageAlt: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    focusKeyword: z.string().max(80),
  }),
  rates: z
    .object({
      enabled: z.boolean(),
      title: z.string().max(160),
      intro: z.string().max(1000),
      sections: z
        .array(
          z.object({
            id: optionalId,
            title: z.string().max(120),
            kind,
            isVisible: z.boolean(),
            sortOrder: z.coerce.number().int(),
            remove: z.boolean(),
            commission: money,
            bonusSlabs: z.array(z.object({ minSqft: z.string().max(10), bonus: money })).max(20),
            hasFitting: z.boolean(),
            fittingRate: money,
            askDesignCode: z.boolean(),
            showOn: z.array(z.string().max(200)).max(200),
            groups: z
              .array(
                z.object({
                  id: optionalId,
                  name: z.string().max(120),
                  subtitle: z.string().max(80),
                  description: z.string().max(5000),
                  imageAlt: z.string().max(200),
                  rate: money,
                  isVisible: z.boolean(),
                  sortOrder: z.coerce.number().int(),
                  featureIds: z.array(z.string().max(200)).max(100),
                  remove: z.boolean(),
                  buttons: z
                    .array(
                      z.object({
                        id: optionalId,
                        label: z.string().max(60),
                        rate: money,
                        rule: kind.nullable(),
                        isVisible: z.boolean(),
                        sortOrder: z.coerce.number().int(),
                        remove: z.boolean(),
                      }),
                    )
                    .max(200),
                }),
              )
              .max(100),
          }),
        )
        .max(30),
    })
    .nullable(),
  features: z
    .array(z.object({ id: optionalId, label: z.string().max(80), isVisible: z.boolean(), sortOrder: z.coerce.number().int(), remove: z.boolean() }))
    .max(200)
    .nullable(),
  gallery: z.array(z.object({ id: z.string().max(200), alt: z.string().max(200), sortOrder: z.coerce.number().int(), remove: z.boolean() })).max(100),
});

const isTemp = (id: string | undefined) => !id || id.startsWith("new:");

/** Rupees typed in a box → paisa; "" → null (keep the saved value). */
function rupeesOrKeep(text: string, label: string): number | null {
  if (text.trim() === "") return null;
  const minor = parseRupees(text.trim());
  if (minor === null) throw new AdminInputError(`${label}: enter an amount in rupees, e.g. 45 or 45.50.`);
  return minor;
}

export async function saveCategoryFull(id: string, raw: unknown): Promise<void> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AdminInputError(`Some settings could not be read (${issue?.path.join(" › ")}: ${issue?.message}). Reload the page and try again.`);
  }
  const input = parsed.data;
  const current = await getCategoryFullData(id);
  if (!current) throw new AdminInputError("This category no longer exists.");

  // 1. Basic info and SEO: the same checks as the Categories & Services form (slug unique among siblings…)
  const c = input.category;
  const basic = categoryInputSchema.safeParse({ ...c, parentId: current.parentId ?? "" });
  if (!basic.success) throw new AdminInputError(basic.error.issues[0]?.message ?? "Check the basic info.");
  await saveCategory(id, basic.data);
  if (c.focusKeyword.trim() !== current.editable.category.focusKeyword) {
    await prisma.category.update({ where: { id }, data: { focusKeyword: c.focusKeyword.trim() || null } });
  }

  // 2. Gallery: alt text, order, delete
  const galleryIds = new Set(current.images.gallery.map((g) => g.id));
  for (const g of input.gallery.filter((x) => galleryIds.has(x.id))) {
    const before = current.editable.gallery.find((x) => x.id === g.id)!;
    if (g.remove) {
      const row = await prisma.categoryImage.delete({ where: { id: g.id }, select: { key: true } });
      await deleteFile(row.key).catch(() => {});
    } else if (g.alt !== before.alt || g.sortOrder !== before.sortOrder) {
      await prisma.categoryImage.update({ where: { id: g.id }, data: { alt: g.alt.trim() || null, sortOrder: g.sortOrder } });
    }
  }

  if (!current.rateEnabled) return;

  await prisma.$transaction(
    async (tx) => {
      // 3. The features list (shared by every sign board quality). New features get real ids first.
      const featureIdMap = new Map<string, string>();
      if (input.features) {
        const before = new Map((current.editable.features ?? []).map((f) => [f.id, f]));
        for (const f of input.features) {
          if (!isTemp(f.id) && before.has(f.id!)) {
            const old = before.get(f.id!)!;
            if (f.remove) {
              await tx.rateFeature.delete({ where: { id: f.id } });
              await tx.$executeRaw`UPDATE "RateItem" SET "featureIds" = array_remove("featureIds", ${f.id}) WHERE ${f.id} = ANY("featureIds")`;
            } else {
              if (!f.label.trim()) throw new AdminInputError("A feature cannot be empty: tick Delete to remove it.");
              if (f.label.trim() !== old.label || f.isVisible !== old.isVisible || f.sortOrder !== old.sortOrder) {
                await tx.rateFeature.update({ where: { id: f.id }, data: { label: f.label.trim(), isVisible: f.isVisible, sortOrder: f.sortOrder } });
              }
            }
          } else if (isTemp(f.id) && !f.remove && f.label.trim()) {
            const created = await tx.rateFeature.create({ data: { label: f.label.trim(), isVisible: f.isVisible, sortOrder: f.sortOrder } });
            if (f.id) featureIdMap.set(f.id, created.id);
          }
        }
      }
      const liveFeatures = new Set((await tx.rateFeature.findMany({ select: { id: true } })).map((f) => f.id));
      const mapFeatures = (ids: string[]) => [...new Set(ids.map((x) => featureIdMap.get(x) ?? x).filter((x) => liveFeatures.has(x)))];

      // 4. Rates & calculator
      const rates = input.rates;
      if (!rates) return;
      const allowedShowOn = new Set(current.rateChoices.map((x) => x.id));
      const beforeSections = new Map((current.editable.rates?.sections ?? []).map((s) => [s.id, s]));
      const wantsPage = rates.sections.some((s) => !s.remove);
      let pageId = (await tx.ratePage.findUnique({ where: { categoryId: id }, select: { id: true } }))?.id ?? null;
      const seo = { seoTitle: c.seoTitle.trim() || null, seoDescription: c.seoDescription.trim() || null };
      if (!pageId && wantsPage) {
        pageId = (await tx.ratePage.create({ data: { categoryId: id, title: rates.title.trim() || `${c.name} Price per Sq Ft in Lahore`, intro: rates.intro.trim() || null, isVisible: rates.enabled, ...seo } })).id;
      } else if (pageId) {
        const before = current.editable.rates!;
        if (rates.title.trim() !== before.title || rates.intro.trim() !== before.intro || rates.enabled !== before.enabled || seo.seoTitle !== (current.editable.category.seoTitle || null) || seo.seoDescription !== (current.editable.category.seoDescription || null)) {
          if (rates.title.trim().length < 3) throw new AdminInputError("Rates: enter the page title (H1).");
          await tx.ratePage.update({ where: { id: pageId }, data: { title: rates.title.trim(), intro: rates.intro.trim() || null, isVisible: rates.enabled, ...seo } });
        }
      }
      if (!pageId) return;

      for (const [si, s] of rates.sections.entries()) {
        const where = `Section ${si + 1} (${s.title || "untitled"})`;
        const old = !isTemp(s.id) ? beforeSections.get(s.id!) : undefined;
        if (!isTemp(s.id) && !old) throw new AdminInputError(`${where} belongs to another page. Reload and try again.`);
        if (s.remove) {
          if (old) await deleteSectionTx(tx, old.id);
          continue;
        }
        if (s.title.trim().length < 3) throw new AdminInputError(`${where}: enter the section title.`);
        const commission = rupeesOrKeep(s.commission, `${where}: commission per sq ft`);
        const fitting = s.hasFitting ? (rupeesOrKeep(s.fittingRate, `${where}: fitting charges`) ?? (old?.hasFitting ? null : 0)) : undefined;
        const slabs = s.bonusSlabs
          .filter((b) => b.minSqft.trim() || b.bonus.trim())
          .map((b, i) => {
            const minSqft = Number(b.minSqft);
            const bonusMinor = rupeesOrKeep(b.bonus, `${where}: bonus ${i + 1}`);
            if (!(minSqft > 0) || !bonusMinor) throw new AdminInputError(`${where}: bonus ${i + 1} needs the sq ft and the amount.`);
            return { minSqft, bonusMinor };
          });
        const values = {
          title: s.title.trim(),
          kind: s.kind,
          isVisible: s.isVisible,
          sortOrder: s.sortOrder,
          askDesignCode: s.askDesignCode,
          showOnCategoryIds: s.showOn.filter((x) => allowedShowOn.has(x)),
          bonusSlabs: slabs as unknown as Prisma.InputJsonValue,
          ...(commission !== null ? { commissionPerSqftMinor: commission } : {}),
          ...(s.hasFitting ? (fitting !== null && fitting !== undefined ? { fittingRateMinor: fitting } : {}) : { fittingRateMinor: null }),
        };
        let sectionId: string;
        if (old) {
          sectionId = old.id;
          const changed =
            values.title !== old.title ||
            values.kind !== old.kind ||
            values.isVisible !== old.isVisible ||
            values.sortOrder !== old.sortOrder ||
            values.askDesignCode !== old.askDesignCode ||
            JSON.stringify(values.showOnCategoryIds) !== JSON.stringify(old.showOn) ||
            JSON.stringify(slabs) !== JSON.stringify(old.bonusSlabs.map((b) => ({ minSqft: Number(b.minSqft), bonusMinor: parseRupees(b.bonus) }))) ||
            (commission !== null && commission !== parseRupees(old.commission || "0")) ||
            s.hasFitting !== old.hasFitting ||
            (s.hasFitting && fitting !== null && fitting !== parseRupees(old.fittingRate || "0"));
          if (changed) await tx.rateSection.update({ where: { id: old.id }, data: values });
          if (values.kind !== old.kind) await tx.rateItem.updateMany({ where: { sectionId: old.id }, data: { variantType: variantTypeFor(values.kind) } });
        } else {
          sectionId = (
            await tx.rateSection.create({
              data: { pageId, ...values, commissionPerSqftMinor: commission ?? defaultCommission(s.kind), fittingRateMinor: s.hasFitting ? (fitting ?? 0) : null },
            })
          ).id;
        }

        const beforeGroups = new Map((old?.groups ?? []).map((g) => [g.id, g]));
        for (const [gi, g] of s.groups.entries()) {
          const gWhere = `${where} › ${g.name || `row ${gi + 1}`}`;
          const oldG = !isTemp(g.id) ? beforeGroups.get(g.id!) : undefined;
          if (!isTemp(g.id) && !oldG) throw new AdminInputError(`${gWhere} belongs to another section. Reload and try again.`);
          if (g.remove) {
            if (oldG) {
              await tx.rateVariant.deleteMany({ where: { itemId: oldG.id } });
              await tx.rateItem.delete({ where: { id: oldG.id } });
            }
            continue;
          }
          if (g.name.trim().length < 2) throw new AdminInputError(`${gWhere}: enter the name.`);
          const rate = s.kind === "SIGN_BOARD" ? rupeesOrKeep(g.rate, `${gWhere}: rate per sq ft`) : null;
          const gValues = {
            name: g.name.trim(),
            subtitle: g.subtitle.trim() || null,
            description: g.description.trim() || null,
            imageAlt: g.imageAlt.trim() || null,
            isVisible: g.isVisible,
            sortOrder: g.sortOrder,
            featureIds: mapFeatures(g.featureIds),
            variantType: variantTypeFor(s.kind),
            ...(rate !== null ? { rateMinor: rate } : {}),
          };
          let itemId: string;
          if (oldG) {
            itemId = oldG.id;
            const changed =
              gValues.name !== oldG.name ||
              (gValues.subtitle ?? "") !== oldG.subtitle ||
              (gValues.description ?? "") !== oldG.description ||
              (gValues.imageAlt ?? "") !== oldG.imageAlt ||
              gValues.isVisible !== oldG.isVisible ||
              gValues.sortOrder !== oldG.sortOrder ||
              JSON.stringify(gValues.featureIds) !== JSON.stringify(oldG.featureIds) ||
              (rate !== null && rate !== parseRupees(oldG.rate || "0"));
            if (changed) await tx.rateItem.update({ where: { id: oldG.id }, data: gValues });
          } else {
            itemId = (await tx.rateItem.create({ data: { pageId, sectionId, ...gValues, rateMinor: rate ?? 0 } })).id;
          }

          if (s.kind === "SIGN_BOARD") continue;
          const kept = g.buttons.filter((b) => !b.remove && (b.label.trim() || !isTemp(b.id)));
          const labels = kept.map((b) => b.label.trim().toLowerCase());
          if (kept.some((b) => !b.label.trim())) throw new AdminInputError(`${gWhere}: every button needs its text (e.g. 240 GSM). Tick Delete to remove one.`);
          const dup = labels.find((l, i) => labels.indexOf(l) !== i);
          if (dup) throw new AdminInputError(`${gWhere}: two buttons have the same text (“${dup}”).`);
          const beforeButtons = new Map((oldG?.buttons ?? []).map((b) => [b.id, b]));
          // Deletes first, so a deleted button's text can be used again at once
          const removeIds = g.buttons.filter((b) => b.remove && !isTemp(b.id) && beforeButtons.has(b.id!)).map((b) => b.id!);
          if (removeIds.length) await tx.rateVariant.deleteMany({ where: { itemId, id: { in: removeIds } } });
          for (const [bi, b] of kept.entries()) {
            const bRate = rupeesOrKeep(b.rate, `${gWhere} › ${b.label || `button ${bi + 1}`}`);
            const oldB = !isTemp(b.id) ? beforeButtons.get(b.id!) : undefined;
            const bValues = { label: b.label.trim(), rule: b.rule, isVisible: b.isVisible, sortOrder: b.sortOrder, ...(bRate !== null ? { rateMinor: bRate } : {}) };
            if (oldB) {
              const changed = bValues.label !== oldB.label || bValues.rule !== oldB.rule || bValues.isVisible !== oldB.isVisible || bValues.sortOrder !== oldB.sortOrder || (bRate !== null && bRate !== parseRupees(oldB.rate || "0"));
              if (changed) await tx.rateVariant.update({ where: { id: oldB.id, itemId }, data: bValues });
            } else if (isTemp(b.id)) {
              await tx.rateVariant.create({ data: { itemId, ...bValues, rateMinor: bRate ?? 0 } });
            }
          }
        }
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

const variantTypeFor = (k: Kind) => (k === "FLEX" ? "GSM" : k === "STICKER" ? "SERIES" : "NONE") as "GSM" | "SERIES" | "NONE";
/** Default affiliate commission per sq ft for a new section: Flex Rs 5, Stickers Rs 10, Sign Boards Rs 50. */
export const defaultCommission = (k: Kind) => (k === "FLEX" ? 500 : k === "STICKER" ? 1000 : 5000);

async function deleteSectionTx(tx: Prisma.TransactionClient, sectionId: string) {
  const items = await tx.rateItem.findMany({ where: { sectionId }, select: { id: true } });
  await tx.rateVariant.deleteMany({ where: { itemId: { in: items.map((i) => i.id) } } });
  await tx.rateItem.deleteMany({ where: { sectionId } });
  await tx.rateSection.delete({ where: { id: sectionId } });
}

// ─── Images (saved at once, not with the Save button) ────────────────────────

export async function addCategoryGalleryImages(id: string, files: Uint8Array[]) {
  const category = await prisma.category.findUnique({ where: { id }, select: { name: true } });
  if (!category) throw new AdminInputError("This category no longer exists.");
  const last = await prisma.categoryImage.findFirst({ where: { categoryId: id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  let order = (last?.sortOrder ?? -1) + 1;
  for (const bytes of files) {
    const image = await toWebp(bytes, 1600);
    if (!image.ok) throw new AdminInputError(image.error);
    const stored = await saveFile(descriptiveKey("categories", category.name, image.ext), image.bytes, image.type);
    await prisma.categoryImage.create({ data: { categoryId: id, url: stored.url, key: stored.key, alt: category.name, sortOrder: order++ } });
  }
}

export async function setCategoryOgImage(id: string, bytes: Uint8Array | null) {
  const category = await prisma.category.findUnique({ where: { id }, select: { name: true, ogImageKey: true } });
  if (!category) throw new AdminInputError("This category no longer exists.");
  let data: { ogImageUrl: string | null; ogImageKey: string | null } = { ogImageUrl: null, ogImageKey: null };
  if (bytes) {
    const image = await toWebp(bytes, 1200, 630);
    if (!image.ok) throw new AdminInputError(image.error);
    const stored = await saveFile(descriptiveKey("social", category.name, image.ext), image.bytes, image.type);
    data = { ogImageUrl: stored.url, ogImageKey: stored.key };
  }
  await prisma.category.update({ where: { id }, data });
  if (category.ogImageKey) await deleteFile(category.ogImageKey).catch(() => {});
}
