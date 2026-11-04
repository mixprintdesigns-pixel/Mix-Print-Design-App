import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { getOrderConfirmation } from "@/lib/orders/website-order";
import {
  addRateGroup,
  addRateSection,
  createRatePage,
  deleteRateGroup,
  deleteRateSection,
  getRatePageForAdmin,
  rateServiceChoices,
  saveRateFeatures,
  saveRateGroup,
  saveRateSettings,
} from "@/lib/rates/admin";
import { placeRateOrder, rateOrderSchema } from "@/lib/rates/order";
import { readRateFeatures, readRateSettings } from "@/lib/rates/queries";
import { publicSections } from "@/lib/rates/visibility";
import { resetDatabase } from "../support/db";

// Admin → Rates (sections, buttons, qualities, features) and "Order now" from a rate section.

beforeEach(resetDatabase);

const form = (values: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) for (const x of [v].flat()) data.append(k, x);
  return data;
};

/** Button rows in the editor's form format. */
const buttons = (rows: { id?: string; label: string; rate: string; show?: boolean; del?: boolean; order?: number }[]) => {
  const out: Record<string, string> = { b_count: String(rows.length) };
  rows.forEach((r, i) => {
    out[`b_id_${i}`] = r.id ?? "";
    out[`b_label_${i}`] = r.label;
    out[`b_rate_${i}`] = r.rate;
    out[`b_order_${i}`] = String(r.order ?? i);
    if (r.show !== false) out[`b_on_${i}`] = "on";
    if (r.del) out[`b_del_${i}`] = "on";
  });
  return out;
};

async function services() {
  const board = await prisma.category.create({ data: { name: "Sign Board Maker", slug: "board-maker" } });
  const backlit = await prisma.category.create({ data: { name: "Backlit Sign Board", slug: "backlit-sign-board", parentId: board.id } });
  const digital = await prisma.category.create({ data: { name: "Digital Printing", slug: "digital-printing" } });
  const offset = await prisma.category.create({ data: { name: "Offset Printing", slug: "offset-printing" } });
  return { board, backlit, digital, offset };
}

async function sectionsOf(pageId: string) {
  const page = await getRatePageForAdmin(pageId);
  return publicSections(page!.sections, await readRateFeatures());
}

/** Digital Printing with a Flex section (240 GSM Rs 45, 280 GSM Rs 55) and a Sticker section (Vinyl 1000 series Rs 30). */
async function digitalPage() {
  const { digital } = await services();
  const page = await createRatePage(form({ categoryId: digital.id }));
  await addRateSection(page.id, form({ title: "Flex GSM & Rate per sq ft (Rs)", kind: "FLEX" }));
  await addRateSection(page.id, form({ title: "Sticker Series & Rate per sq ft (Rs)", kind: "STICKER" }));
  const [flex, sticker] = (await getRatePageForAdmin(page.id))!.sections;
  const gsmRow = await addRateGroup(flex.id, form({ name: "Flex" }));
  await saveRateGroup(gsmRow, form({ id: gsmRow, name: "Flex", isVisible: "on", ...buttons([{ label: "240 GSM", rate: "45" }, { label: "280 GSM", rate: "55" }, { label: "300 GSM", rate: "0" }]) }));
  const vinyl = await addRateGroup(sticker.id, form({ name: "Vinyl" }));
  await saveRateGroup(vinyl, form({ id: vinyl, name: "Vinyl", isVisible: "on", ...buttons([{ label: "1000 Series", rate: "30" }]) }));
  const variant = async (itemId: string, label: string) => (await prisma.rateVariant.findFirstOrThrow({ where: { itemId, label } })).id;
  return { page, flex, sticker, gsmRow, vinyl, g240: await variant(gsmRow, "240 GSM"), s1000: await variant(vinyl, "1000 Series") };
}

const customer = { name: "Bilal Ahmed", phone: "0300 7654321", city: "Model Town, Lahore", note: "" };

describe("Admin → Rates", () => {
  it("rate pages go on Sign Board Maker and Digital Printing pages only", async () => {
    const { offset } = await services();
    const names = (await rateServiceChoices()).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Sign Board Maker", "Backlit Sign Board", "Digital Printing"]));
    expect(names).not.toContain("Offset Printing");
    await expect(createRatePage(form({ categoryId: offset.id }))).rejects.toThrow(/Choose the service page/);
  });

  it("a new board type gets its page and a Sign Board section, without touching other categories", async () => {
    const { board } = await services();
    const before = await prisma.category.findMany({ orderBy: { id: "asc" } });
    const page = await createRatePage(form({ newBoardName: "Neon Sign Board" }));
    expect((await prisma.category.findFirstOrThrow({ where: { slug: "neon-sign-board" } })).parentId).toBe(board.id);
    const admin = await getRatePageForAdmin(page.id);
    expect(admin!.sections.map((s) => [s.title, s.kind])).toEqual([["Neon Sign Board Rate per sq ft (Rs)", "SIGN_BOARD"]]);
    expect(await prisma.category.findMany({ where: { id: { in: before.map((c) => c.id) } }, orderBy: { id: "asc" } })).toEqual(before);
  });

  it("buttons: free-text GSMs with their own rates; rate 0 is not shown; edit, reorder, hide and delete", async () => {
    const { page, gsmRow, g240 } = await digitalPage();
    expect((await sectionsOf(page.id))[0].groups[0].buttons.map((b) => [b.label, b.rateMinor])).toEqual([
      ["240 GSM", 4500],
      ["280 GSM", 5500],
    ]);
    const all = await prisma.rateVariant.findMany({ where: { itemId: gsmRow }, orderBy: { sortOrder: "asc" } });
    const id = (label: string) => all.find((x) => x.label === label)!.id;
    await saveRateGroup(
      gsmRow,
      form({
        id: gsmRow,
        name: "Flex",
        isVisible: "on",
        ...buttons([
          { id: g240, label: "240 GSM", rate: "47.50", order: 5 },
          { id: id("280 GSM"), label: "280 GSM", rate: "55", show: false },
          { id: id("300 GSM"), label: "300 GSM", rate: "0", del: true },
          { label: "333 GSM", rate: "70", order: 1 },
        ]),
      }),
    );
    expect((await sectionsOf(page.id))[0].groups[0].buttons.map((b) => [b.label, b.rateMinor])).toEqual([
      ["333 GSM", 7000],
      ["240 GSM", 4750],
    ]);
    expect(await prisma.rateVariant.count({ where: { itemId: gsmRow } })).toBe(3); // 300 GSM deleted
    await expect(saveRateGroup(gsmRow, form({ id: gsmRow, name: "Flex", ...buttons([{ label: "A", rate: "1" }, { label: "a", rate: "2" }]) }))).rejects.toThrow(/same text/);
  });

  it("sections: rename, change the rule, hide, delete with all their rows and buttons", async () => {
    const { page, sticker, vinyl } = await digitalPage();
    expect((await sectionsOf(page.id)).map((s) => s.kind)).toEqual(["FLEX", "STICKER"]);
    const { saveRateSection } = await import("@/lib/rates/admin");
    await saveRateSection(sticker.id, form({ title: "Stickers (Rs per sq ft)", kind: "STICKER", sortOrder: "0" }));
    expect((await sectionsOf(page.id)).map((s) => s.title)).toEqual(["Flex GSM & Rate per sq ft (Rs)"]); // hidden: "Show" not ticked
    await deleteRateSection(sticker.id);
    expect(await prisma.rateItem.count({ where: { id: vinyl } })).toBe(0);
    expect(await prisma.rateSection.count({ where: { pageId: page.id } })).toBe(1);
  });

  it("sign board qualities: one rate, feature ticks from the master list, delete", async () => {
    const { backlit } = await services();
    const page = await createRatePage(form({ categoryId: backlit.id }));
    const section = (await getRatePageForAdmin(page.id))!.sections[0];
    await saveRateFeatures(form({ f_count: "0", f_new: ["Waterproof", "LED lights", "Warranty"] }));
    const features = await readRateFeatures();
    const premium = await addRateGroup(section.id, form({ name: "Premium Backlit Sign Board", subtitle: "Premium" }));
    await saveRateGroup(premium, form({ id: premium, name: "Premium Backlit Sign Board", subtitle: "Premium", rate: "600", isVisible: "on", [`feature_${features[1].id}`]: "on", description: "Bright." }));
    const [s] = await sectionsOf(page.id);
    expect(s.groups[0]).toMatchObject({ name: "Premium Backlit Sign Board", buttons: [{ label: "Premium", rateMinor: 60000 }], description: "Bright." });
    expect(s.groups[0].features).toEqual([
      { label: "Waterproof", included: false },
      { label: "LED lights", included: true },
      { label: "Warranty", included: false },
    ]);

    // Deleting a feature unticks it everywhere
    const list = Object.fromEntries(features.flatMap((f, i) => [[`f_id_${i}`, f.id], [`f_label_${i}`, f.label], [`f_order_${i}`, String(i)], [`f_on_${i}`, "on"]]));
    await saveRateFeatures(form({ ...list, f_count: String(features.length), f_del_1: "on" }));
    expect((await prisma.rateItem.findUniqueOrThrow({ where: { id: premium } })).featureIds).toEqual([]);
    expect((await readRateFeatures()).map((f) => f.label)).toEqual(["Waterproof", "Warranty"]);

    await deleteRateGroup(premium);
    expect(await sectionsOf(page.id)).toEqual([]);
  });

  it("designing charges and minimum order", async () => {
    expect((await readRateSettings()).designChargeMinor).toBe(100_000);
    await saveRateSettings(form({ designCharge: "1,500", minOrder: "" }));
    expect(await readRateSettings()).toEqual({ designChargeMinor: 150_000, minOrderMinor: null });
    await expect(saveRateSettings(form({ designCharge: "abc" }))).rejects.toThrow(/Designing charges/);
  });
});

describe("Order now from a rate section", () => {
  it("flex: saves the order with the server's price, size as typed, billable size and fixed designing charges", async () => {
    const { gsmRow, g240 } = await digitalPage();
    const input = rateOrderSchema.parse({ itemId: gsmRow, variantId: g240, unit: "ft-in", width: { value: 10, inches: 3 }, height: { value: 5, inches: 0 }, ...customer });
    const result = await placeRateOrder(input, { referralCode: null });
    if (!result.ok) throw new Error(result.error);

    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { items: { orderBy: { lineTotalMinor: "desc" } } } });
    // 11 × 5 = 55 sq ft × Rs 45 = Rs 2,475 + Rs 1,000 = Rs 3,475
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", source: "WEBSITE", totalMinor: 347_500, subtotalMinor: 347_500 });
    expect(order.items.map((i) => [i.productName, i.lineTotalMinor])).toEqual([
      ["Flex 240 GSM", 247_500],
      ["Designing charges", 100_000],
    ]);
    const text = decodeURIComponent(result.whatsappUrl);
    for (const part of [`Order #${result.number}`, "*Flex 240 GSM*", "Option: 240 GSM", "Size: 10 ft 3 in × 5 ft", "Billable size: 11 ft × 5 ft", "Billable area: 55 sq ft", "Designing charges: PKR 1,000", "Total: PKR 3,475"]) {
      expect(text).toContain(part);
    }
    expect((await getOrderConfirmation(result.number, result.confirmationPath.split("t=")[1]))?.totalMinor).toBe(347_500);
  });

  it("stickers use the 4.5 ft roll rule and round the total to the rupee", async () => {
    const { vinyl, s1000 } = await digitalPage();
    // 9 ft 1 in × 6 ft 2 in → 13.5 × 6.1667 = 83.25 sq ft × Rs 30 = Rs 2,497.50 + 1,000 = Rs 3,497.50 → Rs 3,498
    const input = rateOrderSchema.parse({ itemId: vinyl, variantId: s1000, unit: "ft-in", width: { value: 9, inches: 1 }, height: { value: 6, inches: 2 }, ...customer });
    const result = await placeRateOrder(input, { referralCode: null });
    if (!result.ok) throw new Error(result.error);
    expect((await prisma.order.findUniqueOrThrow({ where: { number: result.number } })).totalMinor).toBe(349_800);
    expect(decodeURIComponent(result.whatsappUrl)).toContain("Billable size: 13.5 ft × 6 ft 2 in");
  });

  it("ignores any price from the browser and refuses hidden, zero-rate or mismatched buttons", async () => {
    const { gsmRow, vinyl, g240, s1000 } = await digitalPage();
    const zero = (await prisma.rateVariant.findFirstOrThrow({ where: { itemId: gsmRow, label: "300 GSM" } })).id;
    const base = { unit: "cm", width: { value: 152.4 }, height: { value: 91.44 }, ...customer, rateMinor: 1, totalMinor: 1 };
    const ok = await placeRateOrder(rateOrderSchema.parse({ ...base, itemId: gsmRow, variantId: g240 }), { referralCode: null });
    if (!ok.ok) throw new Error(ok.error);
    expect((await prisma.order.findUniqueOrThrow({ where: { number: ok.number } })).totalMinor).toBe(167_500); // 15 × 45 + 1,000
    for (const bad of [{ itemId: gsmRow, variantId: zero }, { itemId: gsmRow, variantId: "" }, { itemId: gsmRow, variantId: s1000 }, { itemId: vinyl, variantId: g240 }]) {
      expect((await placeRateOrder(rateOrderSchema.parse({ ...base, ...bad }), { referralCode: null })).ok).toBe(false);
    }
  });

  it("sign boards: the quality's rate; the affiliate is attached", async () => {
    const { backlit } = await services();
    const page = await createRatePage(form({ categoryId: backlit.id }));
    const section = (await getRatePageForAdmin(page.id))!.sections[0];
    const normal = await addRateGroup(section.id, form({ name: "Economy Backlit Sign Board", subtitle: "Normal" }));
    await saveRateGroup(normal, form({ id: normal, name: "Economy Backlit Sign Board", subtitle: "Normal", rate: "350", isVisible: "on" }));
    const user = await registerUser({ name: "Ayesha Khan", email: "ayesha@example.com", password: "password123", phone: undefined });
    const affiliate = await applyAsAffiliate(user.id, { payoutMethod: "JAZZCASH", payoutAccount: "+923001234567", payoutAccountName: "Ayesha Khan", website: null, promotionPlan: "Instagram" });
    await setAffiliateStatus(affiliate.id, "APPROVED");

    const input = rateOrderSchema.parse({ itemId: normal, unit: "ft-in", width: { value: 6, inches: 2 }, height: { value: 3 }, ...customer });
    const result = await placeRateOrder(input, { referralCode: affiliate.code });
    if (!result.ok) throw new Error(result.error);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { commission: true } });
    expect(order.totalMinor).toBe(835_000); // 7 × 3 = 21 sq ft × Rs 350 = Rs 7,350 + Rs 1,000
    expect(order.affiliateId).toBe(affiliate.id);
    expect(order.commission?.status).toBe("PENDING");
    expect(decodeURIComponent(result.whatsappUrl)).toContain("Option: Normal");
  });
});
