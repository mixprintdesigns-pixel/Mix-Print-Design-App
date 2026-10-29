import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { deleteFile, newKey, saveFile } from "@/lib/storage";
import { checkImage } from "@/lib/storage/images";
import { toSlug } from "@/lib/slug";

export type ServiceLevel = "category" | "subtype" | "quality";

export class ServiceAdminError extends Error {}

export const levelSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and hyphens.").optional()),
  shortDescription: z.string().trim().min(5, "Enter a short description.").max(300),
  isVisible: z.boolean(),
});
export type LevelData = z.infer<typeof levelSchema>;

// The three levels share the same columns; these helpers pick the right table.
function table(level: ServiceLevel) {
  return { category: prisma.serviceCategory, subtype: prisma.serviceSubtype, quality: prisma.serviceQuality }[level] as unknown as {
    findUnique(args: object): Promise<{ id: string; imageKey: string | null; sortOrder: number } | null>;
    findMany(args: object): Promise<{ id: string; sortOrder: number }[]>;
    create(args: object): Promise<{ id: string }>;
    update(args: object): Promise<{ id: string }>;
    delete(args: object): Promise<unknown>;
  };
}

function parentField(level: ServiceLevel): "categoryId" | "subtypeId" | null {
  return level === "subtype" ? "categoryId" : level === "quality" ? "subtypeId" : null;
}

function isUnique(error: unknown) {
  return (error as { code?: string }).code === "P2002";
}

export async function saveLevel(level: ServiceLevel, id: string | null, parentId: string | null, data: LevelData): Promise<string> {
  const values = { title: data.title, slug: data.slug ?? toSlug(data.title), shortDescription: data.shortDescription, isVisible: data.isVisible };
  if (!values.slug) throw new ServiceAdminError("Enter a title with letters or numbers.");
  try {
    if (id) return (await table(level).update({ where: { id }, data: values })).id;
    const field = parentField(level);
    if (field && !parentId) throw new ServiceAdminError("Choose where to add this.");
    const scope = field ? { [field]: parentId } : {};
    const siblings = await table(level).findMany({ where: scope, select: { id: true, sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 });
    return (await table(level).create({ data: { ...values, ...scope, sortOrder: (siblings[0]?.sortOrder ?? -1) + 1 } })).id;
  } catch (error) {
    if (isUnique(error)) throw new ServiceAdminError("Another item at this level already uses this slug. Change the title or slug.");
    throw error;
  }
}

/** Moves an item one place up or down among its siblings. */
export async function moveLevel(level: ServiceLevel, id: string, direction: "up" | "down"): Promise<void> {
  const field = parentField(level);
  const item = (await table(level).findUnique({ where: { id } })) as ({ id: string } & Record<string, unknown>) | null;
  if (!item) return;
  const scope = field ? { [field]: item[field] } : {};
  const siblings = await table(level).findMany({ where: scope, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, sortOrder: true } });
  const i = siblings.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(siblings.map((s, sortOrder) => (table(level).update({ where: { id: s.id }, data: { sortOrder } }) as never)));
}

/** Deletes an item and everything below it, but only when no products are linked to it. */
export async function deleteLevel(level: ServiceLevel, id: string): Promise<void> {
  const where = { category: { serviceCategoryId: id }, subtype: { serviceSubtypeId: id }, quality: { serviceQualityId: id } }[level];
  if ((await prisma.product.count({ where })) > 0) {
    throw new ServiceAdminError("Products are linked to this. Unlink them first, or hide it instead.");
  }
  const keys: (string | null)[] = [];
  if (level === "category") {
    const c = await prisma.serviceCategory.findUnique({ where: { id }, include: { subtypes: { include: { qualities: true } } } });
    keys.push(c?.imageKey ?? null, ...(c?.subtypes.flatMap((s) => [s.imageKey, ...s.qualities.map((q) => q.imageKey)]) ?? []));
  } else if (level === "subtype") {
    const s = await prisma.serviceSubtype.findUnique({ where: { id }, include: { qualities: true } });
    keys.push(s?.imageKey ?? null, ...(s?.qualities.map((q) => q.imageKey) ?? []));
  } else {
    keys.push((await prisma.serviceQuality.findUnique({ where: { id } }))?.imageKey ?? null);
  }
  await table(level).delete({ where: { id } });
  await Promise.all(keys.filter((k): k is string => !!k).map((k) => deleteFile(k).catch(() => {})));
}

export async function setLevelImage(level: ServiceLevel, id: string, bytes: Uint8Array): Promise<void> {
  const check = checkImage(bytes);
  if (!check.ok) throw new ServiceAdminError(check.error);
  const item = await table(level).findUnique({ where: { id } });
  if (!item) throw new ServiceAdminError("This item no longer exists.");
  const stored = await saveFile(newKey(`services/${level}`, check.ext), bytes, check.type);
  await table(level).update({ where: { id }, data: { imageUrl: stored.url, imageKey: stored.key } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}

export async function removeLevelImage(level: ServiceLevel, id: string): Promise<void> {
  const item = await table(level).findUnique({ where: { id } });
  if (!item) return;
  await table(level).update({ where: { id }, data: { imageUrl: null, imageKey: null } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}

/** Places a product under a service level. A product belongs to one place in the services tree. */
export async function linkProduct(productId: string, level: ServiceLevel, levelId: string): Promise<void> {
  let ids: { serviceCategoryId: string; serviceSubtypeId: string | null; serviceQualityId: string | null };
  if (level === "category") {
    const c = await prisma.serviceCategory.findUnique({ where: { id: levelId } });
    if (!c) throw new ServiceAdminError("Service not found.");
    ids = { serviceCategoryId: c.id, serviceSubtypeId: null, serviceQualityId: null };
  } else if (level === "subtype") {
    const s = await prisma.serviceSubtype.findUnique({ where: { id: levelId } });
    if (!s) throw new ServiceAdminError("Sub-type not found.");
    ids = { serviceCategoryId: s.categoryId, serviceSubtypeId: s.id, serviceQualityId: null };
  } else {
    const q = await prisma.serviceQuality.findUnique({ where: { id: levelId }, include: { subtype: true } });
    if (!q) throw new ServiceAdminError("Quality not found.");
    ids = { serviceCategoryId: q.subtype.categoryId, serviceSubtypeId: q.subtypeId, serviceQualityId: q.id };
  }
  const { count } = await prisma.product.updateMany({ where: { id: productId }, data: ids });
  if (count === 0) throw new ServiceAdminError("Product not found.");
}

export async function unlinkProduct(productId: string): Promise<void> {
  await prisma.product.updateMany({
    where: { id: productId },
    data: { serviceCategoryId: null, serviceSubtypeId: null, serviceQualityId: null },
  });
}

const adminLevel = { id: true, slug: true, title: true, shortDescription: true, imageUrl: true, isVisible: true, sortOrder: true } as const;
const linked = { select: { id: true, name: true, status: true, serviceSubtypeId: true, serviceQualityId: true }, orderBy: { name: "asc" as const } };

/** Full tree including hidden items, with linked products, for Admin → Services. */
export async function getServiceTreeForAdmin() {
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      ...adminLevel,
      products: linked,
      subtypes: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: { ...adminLevel, qualities: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: adminLevel } },
      },
    },
  });
}

export async function listLinkableProducts() {
  return prisma.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, serviceCategoryId: true },
  });
}
