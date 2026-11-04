import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { getOrderConfirmation } from "@/lib/orders/website-order";
import { addRateItem, createRatePage, getRatePageForAdmin, rateServiceChoices, saveRateItem, saveRateSettings, variantRows } from "@/lib/rates/admin";
import { placeRateOrder, rateOrderSchema } from "@/lib/rates/order";
import { readRateSettings } from "@/lib/rates/queries";
import { publicItems } from "@/lib/rates/visibility";
import { resetDatabase } from "../support/db";

// Admin → Rates and "Order now" from a rate page (sign boards, flex, stickers).

beforeEach(resetDatabase);

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};

async function services() {
  const board = await prisma.category.create({ data: { name: "Sign Board Maker", slug: "board-maker" } });
  const backlit = await prisma.category.create({ data: { name: "Backlit Sign Board", slug: "backlit-sign-board", parentId: board.id } });
  const digital = await prisma.category.create({ data: { name: "Digital Printing", slug: "digital-printing" } });
  const offset = await prisma.category.create({ data: { name: "Offset Printing", slug: "offset-printing" } });
  return { board, backlit, digital, offset };
}

/** A flex item with 240 GSM at Rs 35 and 300 GSM at Rs 42 per sq ft (other GSMs off). */
async function flexPage() {
  const { digital } = await services();
  const page = await createRatePage(form({ categoryId: digital.id }));
  const itemId = await addRateItem(page.id, form({ name: "Star Flex", section: "Flex", variantType: "GSM" }));
  const settings = await readRateSettings();
  const rows = variantRows("GSM", settings, []);
  const values: Record<string, string> = { id: itemId, name: "Star Flex", section: "Flex", variantType: "GSM", isVisible: "on", v_count: String(rows.length) };
  rows.forEach((r, i) => {
    values[`v_label_${i}`] = r.label;
    values[`v_rate_${i}`] = r.label === "240 GSM" ? "35" : r.label === "300 GSM" ? "42" : "0";
    if (r.label === "240 GSM" || r.label === "300 GSM") values[`v_on_${i}`] = "on";
  });
  await saveRateItem(itemId, form(values));
  const variants = await prisma.rateVariant.findMany({ where: { itemId } });
  return { page, itemId, v240: variants.find((v) => v.label === "240 GSM")!, v300: variants.find((v) => v.label === "300 GSM")! };
}

const customer = { name: "Bilal Ahmed", phone: "0300 7654321", city: "Model Town, Lahore", note: "" };

describe("Admin → Rates", () => {
  it("rate pages can go on Sign Board Maker and Digital Printing pages only", async () => {
    const { offset } = await services();
    const names = (await rateServiceChoices()).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Sign Board Maker", "Backlit Sign Board", "Digital Printing"]));
    expect(names).not.toContain("Offset Printing");
    await expect(createRatePage(form({ categoryId: offset.id }))).rejects.toThrow(/Choose the service page/);
  });

  it("a new board type creates its page under Sign Board Maker, without touching other categories", async () => {
    const { board } = await services();
    const before = await prisma.category.findMany({ orderBy: { id: "asc" } });
    const page = await createRatePage(form({ newBoardName: "Neon Sign Board" }));
    expect(page.createdCategory).toBe(true);
    const neon = await prisma.category.findFirstOrThrow({ where: { slug: "neon-sign-board" } });
    expect(neon.parentId).toBe(board.id);
    expect((await getRatePageForAdmin(page.id))?.title).toBe("Neon Sign Board Price per Sq Ft in Lahore");
    const after = await prisma.category.findMany({ where: { id: { in: before.map((c) => c.id) } }, orderBy: { id: "asc" } });
    expect(after).toEqual(before);
  });

  it("each GSM keeps its own rate; rate 0 and unticked GSMs are not shown", async () => {
    const { page } = await flexPage();
    const admin = await getRatePageForAdmin(page.id);
    const shown = publicItems(admin!.items);
    expect(shown[0].variants.map((v) => [v.label, v.rateMinor])).toEqual([
      ["240 GSM", 3500],
      ["300 GSM", 4200],
    ]);
  });

  it("settings: design charges, minimum order and the option lists", async () => {
    expect((await readRateSettings()).designChargeMinor).toBe(100_000);
    await saveRateSettings(form({ designCharge: "1,500", minOrder: "", gsmOptions: "300, 200, 250", seriesOptions: "1000 series\n5000 series" }));
    expect(await readRateSettings()).toEqual({ designChargeMinor: 150_000, minOrderMinor: null, gsmOptions: [200, 250, 300], seriesOptions: ["1000 series", "5000 series"] });
    await expect(saveRateSettings(form({ designCharge: "abc" }))).rejects.toThrow(/Design charges/);
  });

  it("items and variants are never deleted: hiding keeps the data", async () => {
    const { itemId } = await flexPage();
    await saveRateItem(itemId, form({ id: itemId, name: "Star Flex", variantType: "NONE", rate: "50" }));
    expect(await prisma.rateVariant.count({ where: { itemId } })).toBe(11);
    expect(await prisma.rateVariant.count({ where: { itemId, isVisible: true } })).toBe(0);
    expect((await prisma.rateItem.findUniqueOrThrow({ where: { id: itemId } })).isVisible).toBe(false); // checkbox not sent
  });
});

describe("Order now from a rate page", () => {
  it("saves the order with the server's price, the size as typed, billable sq ft and the fixed design charge", async () => {
    const { itemId, v300 } = await flexPage();
    const input = rateOrderSchema.parse({ itemId, variantId: v300.id, unit: "ft-in", width: { value: 10, inches: 3 }, height: { value: 5, inches: 0 }, quantity: 1, ...customer });
    const result = await placeRateOrder(input, { referralCode: null });
    if (!result.ok) throw new Error(result.error);

    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { items: { orderBy: { lineTotalMinor: "desc" } } } });
    // 11 ft × 5 ft = 55 sq ft × Rs 42 = Rs 2,310 + Rs 1,000 design = Rs 3,310
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", source: "WEBSITE", totalMinor: 331_000, subtotalMinor: 331_000, customerName: "Bilal Ahmed" });
    expect(order.items.map((i) => [i.productName, i.lineTotalMinor])).toEqual([
      ["Star Flex 300 GSM", 231_000],
      ["Design charges", 100_000],
    ]);
    expect(order.items[0].optionsSummary).toEqual(
      expect.arrayContaining([
        { option: "Material", value: "Star Flex" },
        { option: "GSM", value: "300 GSM" },
        { option: "Size", value: "10 ft 3 in × 5 ft" },
        { option: "Billable area", value: "11 ft × 5 ft = 55 sq ft" },
      ]),
    );
    const text = decodeURIComponent(result.whatsappUrl);
    for (const part of [`Order #${result.number}`, "Star Flex", "GSM: 300 GSM", "Size: 10 ft 3 in × 5 ft", "55 sq ft", "Design charges: PKR 1,000", "Total: PKR 3,310"]) expect(text).toContain(part);
    expect((await getOrderConfirmation(result.number, result.confirmationPath.split("t=")[1]))?.totalMinor).toBe(331_000);
  });

  it("ignores any price from the browser and refuses hidden or zero-rate choices", async () => {
    const { itemId, v240 } = await flexPage();
    const hidden = (await prisma.rateVariant.findFirstOrThrow({ where: { itemId, label: "200 GSM" } })).id;
    const base = { itemId, unit: "cm", width: { value: 152.4 }, height: { value: 100 }, quantity: 2, ...customer, totalMinor: 1 };
    const ok = await placeRateOrder(rateOrderSchema.parse({ ...base, variantId: v240.id }), { referralCode: null });
    if (!ok.ok) throw new Error(ok.error);
    // 5 ft × 4 ft (3.28 → 4) × 2 = 40 sq ft × Rs 35 = Rs 1,400 + Rs 1,000
    expect((await prisma.order.findUniqueOrThrow({ where: { number: ok.number } })).totalMinor).toBe(240_000);
    expect((await placeRateOrder(rateOrderSchema.parse({ ...base, variantId: hidden }), { referralCode: null })).ok).toBe(false);
    expect((await placeRateOrder(rateOrderSchema.parse({ ...base, variantId: "" }), { referralCode: null })).ok).toBe(false);
  });

  it("attaches the affiliate from the referral cookie", async () => {
    const { itemId, v240 } = await flexPage();
    const user = await registerUser({ name: "Ayesha Khan", email: "ayesha@example.com", password: "password123", phone: undefined });
    const affiliate = await applyAsAffiliate(user.id, { payoutMethod: "JAZZCASH", payoutAccount: "+923001234567", payoutAccountName: "Ayesha Khan", website: null, promotionPlan: "Instagram" });
    await setAffiliateStatus(affiliate.id, "APPROVED");
    const input = rateOrderSchema.parse({ itemId, variantId: v240.id, unit: "ft-in", width: { value: 4 }, height: { value: 3 }, quantity: 1, ...customer });
    const result = await placeRateOrder(input, { referralCode: affiliate.code });
    if (!result.ok) throw new Error(result.error);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { commission: true } });
    expect(order.affiliateId).toBe(affiliate.id);
    expect(order.commission?.status).toBe("PENDING");
    expect(decodeURIComponent(result.whatsappUrl)).toContain(`Ref: ${affiliate.code}`);
  });

  it("uses the design charge and minimum order from Admin", async () => {
    const { itemId, v240 } = await flexPage();
    await saveRateSettings(form({ designCharge: "1200", minOrder: "2000", gsmOptions: "240, 300", seriesOptions: "1000 series" }));
    const input = rateOrderSchema.parse({ itemId, variantId: v240.id, unit: "ft-in", width: { value: 2 }, height: { value: 2 }, quantity: 1, ...customer });
    const result = await placeRateOrder(input, { referralCode: null });
    if (!result.ok) throw new Error(result.error);
    // 4 sq ft × Rs 35 = Rs 140 → minimum Rs 2,000 + Rs 1,200 design
    expect((await prisma.order.findUniqueOrThrow({ where: { number: result.number } })).totalMinor).toBe(320_000);
  });
});
