import "server-only";
import { prisma } from "@/lib/db";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { parseRupees } from "@/lib/admin/product-input";
import { deleteFile, saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";

// Calculator settings and sign board quality images. Sections, buttons, rates, commission and features are saved
// from Admin → Categories & Services → All settings (lib/admin/category-full.ts).

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

function rupees(v: FormDataEntryValue | null, label: string): number {
  const text = String(v ?? "").trim();
  const minor = text === "" ? 0 : parseRupees(text);
  if (minor === null) throw new AdminInputError(`${label}: enter an amount in rupees, e.g. 45 or 45.50.`);
  return minor;
}

/** Designing charges (fixed, added to every calculator order) and the optional minimum printing cost. */
export async function saveRateSettings(data: FormData) {
  const designChargeMinor = rupees(data.get("designCharge"), "Designing charges");
  const minText = clean(data.get("minOrder"), 20);
  const minOrderMinor = minText ? rupees(minText, "Minimum order") : null;
  const values = { designChargeMinor, minOrderMinor: minOrderMinor || null };
  await prisma.rateSettings.upsert({ where: { id: "default" }, create: { id: "default", ...values }, update: values });
}

export async function setRateItemImage(itemId: string, bytes: Uint8Array) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { name: true, imageKey: true, imageAlt: true } });
  if (!item) throw new AdminInputError("Save the quality first, then add its image.");
  const image = await toWebp(bytes, 1200);
  if (!image.ok) throw new AdminInputError(image.error);
  const stored = await saveFile(descriptiveKey("rates", item.name, image.ext), image.bytes, image.type);
  await prisma.rateItem.update({ where: { id: itemId }, data: { imageUrl: stored.url, imageKey: stored.key, imageAlt: item.imageAlt || item.name } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}

export async function removeRateItemImage(itemId: string) {
  const item = await prisma.rateItem.findUnique({ where: { id: itemId }, select: { imageKey: true } });
  if (!item) return;
  await prisma.rateItem.update({ where: { id: itemId }, data: { imageUrl: null, imageKey: null } });
  if (item.imageKey) await deleteFile(item.imageKey).catch(() => {});
}
