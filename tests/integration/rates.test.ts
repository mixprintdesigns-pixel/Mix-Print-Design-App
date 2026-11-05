import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { getCategoryFullData, saveCategoryFull, type CategoryFullPayload } from "@/lib/admin/category-full";
import { setOrderTotal, updateOrderStatus } from "@/lib/orders/manual";
import { placeRateOrder, rateOrderSchema } from "@/lib/rates/order";
import { readRateSettings } from "@/lib/rates/queries";
import { saveRateSettings } from "@/lib/rates/admin";
import { resetDatabase } from "../support/db";

// Admin → Categories & Services → All settings (rates, commission, features), and Order now from a rate section.

beforeEach(resetDatabase);

let n = 0;
const tmp = () => `new:t${n++}`;

async function tree() {
  const digital = await prisma.category.create({ data: { name: "Digital Printing", slug: "digital-printing" } });
  const flexPrinting = await prisma.category.create({ data: { name: "Flex Printing", slug: "flex-printing", parentId: digital.id } });
  const china = await prisma.category.create({ data: { name: "China Flex", slug: "china-flex", parentId: flexPrinting.id } });
  const board = await prisma.category.create({ data: { name: "Sign Board Maker", slug: "board-maker" } });
  const backlit = await prisma.category.create({ data: { name: "Backlit Sign Board", slug: "backlit-sign-board", parentId: board.id } });
  const offset = await prisma.category.create({ data: { name: "Offset Printing", slug: "offset-printing" } });
  return { digital, flexPrinting, china, board, backlit, offset };
}

async function edit(categoryId: string, change: (p: CategoryFullPayload) => void) {
  const data = (await getCategoryFullData(categoryId))!;
  const payload = structuredClone(data.editable);
  change(payload);
  await saveCategoryFull(categoryId, payload);
  return (await getCategoryFullData(categoryId))!;
}

const button = (label: string, rate: string, rule: "FLEX" | "STICKER" | "SIGN_BOARD" | null = null, sortOrder = 0) => ({ id: tmp(), label, rate, rule, isVisible: true, sortOrder, remove: false });
const group = (name: string, buttons: ReturnType<typeof button>[], extra: Partial<CategoryFullPayload["rates"] extends infer R ? R extends { sections: (infer S)[] } ? S extends { groups: (infer G)[] } ? G : never : never : never> = {}) => ({
  id: tmp(),
  name,
  subtitle: "",
  description: "",
  imageAlt: "",
  rate: "",
  isVisible: true,
  sortOrder: 0,
  featureIds: [] as string[],
  remove: false,
  buttons,
  ...extra,
});
const section = (title: string, kind: "FLEX" | "STICKER" | "SIGN_BOARD", groups: ReturnType<typeof group>[], extra: Record<string, unknown> = {}) => ({
  id: tmp(),
  title,
  kind,
  isVisible: true,
  sortOrder: 0,
  remove: false,
  commission: kind === "FLEX" ? "5" : kind === "STICKER" ? "10" : "50",
  bonusSlabs: [] as { minSqft: string; bonus: string }[],
  hasFitting: false,
  fittingRate: "0",
  askDesignCode: false,
  showOn: [] as string[],
  groups,
  ...extra,
});

const ratesOf = async (categoryId: string) =>
  Object.fromEntries(
    (await prisma.rateVariant.findMany({ where: { item: { page: { categoryId } } }, select: { label: true, rateMinor: true } })).map((v) => [v.label, v.rateMinor]),
  );

/** Digital Printing: Flex (GSM row + Most Famous), Backlit Flex, Stickers, all with rates. */
async function digitalWithRates() {
  const t = await tree();
  await edit(t.digital.id, (p) => {
    p.rates!.sections.push(
      section("Flex GSM & Rate per sq ft (Rs)", "FLEX", [group("Flex", [button("240 GSM", "45"), button("280 GSM", "55", null, 1)]), group("Most Famous Flex Names", [button("China Flex 240 GSM", "45"), button("Reflective Flex 400 GSM", "90", "STICKER", 1)], { sortOrder: 1 })], { showOn: [t.flexPrinting.id] }),
      section("Backlit Flex GSM & Rate per sq ft (Rs)", "FLEX", [group("Backlit Flex", [button("300 GSM", "60"), button("340 GSM", "70", null, 1)])], { sortOrder: 1 }),
      section("Sticker Series & Rate per sq ft (Rs)", "STICKER", [group("Vinyl", [button("1000 Series", "30"), button("2000 Series", "35", null, 1)])], { sortOrder: 2 }),
    );
  });
  return t;
}

describe("Part 1 – adding a button never resets the other rates", () => {
  it.each([
    ["Flex", "Flex GSM & Rate per sq ft (Rs)", 1, "Reflective Flex 400 GSM X", "95"],
    ["Backlit Flex", "Backlit Flex GSM & Rate per sq ft (Rs)", 0, "380 GSM", "80"],
    ["Stickers", "Sticker Series & Rate per sq ft (Rs)", 0, "3000 Series", "40"],
  ])("%s: add a new button, save, reload: every old rate is still there", async (_name, title, groupIndex, label, rate) => {
    const t = await digitalWithRates();
    const before = await ratesOf(t.digital.id);
    expect(Object.values(before).every((r) => r > 0)).toBe(true);
    await edit(t.digital.id, (p) => {
      p.rates!.sections.find((s) => s.title === title)!.groups[groupIndex].buttons.push(button(label, rate, null, 9));
    });
    expect(await ratesOf(t.digital.id)).toEqual({ ...before, [label]: Number(rate) * 100 });
  });

  it("an empty rate box keeps the saved rate; editing one button changes only that button", async () => {
    const t = await digitalWithRates();
    const before = await ratesOf(t.digital.id);
    await edit(t.digital.id, (p) => {
      const flex = p.rates!.sections[0].groups[0];
      flex.buttons[0].rate = ""; // cleared by mistake
      flex.buttons[1].rate = "57.50"; // the one real change
    });
    expect(await ratesOf(t.digital.id)).toEqual({ ...before, "280 GSM": 5750 });
  });

  it("delete and reorder only touch the buttons concerned", async () => {
    const t = await digitalWithRates();
    const before = await ratesOf(t.digital.id);
    await edit(t.digital.id, (p) => {
      const vinyl = p.rates!.sections[2].groups[0];
      vinyl.buttons[1].remove = true;
      vinyl.buttons[0].sortOrder = 5;
    });
    const { ["2000 Series"]: _gone, ...rest } = before;
    expect(await ratesOf(t.digital.id)).toEqual(rest);
  });
});

describe("All settings: sections, features, commission, SEO", () => {
  it("the calculator settings are only offered for Digital Printing and Sign Board Maker", async () => {
    const t = await tree();
    expect((await getCategoryFullData(t.offset.id))!.editable.rates).toBeNull();
    expect((await getCategoryFullData(t.china.id))!.editable.rates).not.toBeNull();
  });

  it("features: add, tick per quality, delete (unticked everywhere); SEO and basic info", async () => {
    const t = await tree();
    let data = await edit(t.backlit.id, (p) => {
      p.features!.push({ id: "new:f1", label: "Iron pipe frame", isVisible: true, sortOrder: 0, remove: false }, { id: "new:f2", label: "Paint finish", isVisible: true, sortOrder: 1, remove: false });
      p.rates!.sections.push(section("Backlit Sign Board Rate per sq ft (Rs)", "SIGN_BOARD", [group("Premium Backlit Sign Board", [], { subtitle: "Premium", rate: "600", featureIds: ["new:f1"] })], { showOn: [t.backlit.id] }));
      p.category.seoTitle = "Backlit Sign Boards in Lahore";
      p.category.focusKeyword = "backlit sign board";
    });
    const premium = data.editable.rates!.sections[0].groups[0];
    const iron = data.editable.features!.find((f) => f.label === "Iron pipe frame")!;
    expect(premium).toMatchObject({ rate: "600", featureIds: [iron.id] });
    expect(data.editable.category).toMatchObject({ seoTitle: "Backlit Sign Boards in Lahore", focusKeyword: "backlit sign board" });
    data = await edit(t.backlit.id, (p) => {
      p.features!.find((f) => f.id === iron.id)!.remove = true;
    });
    expect(data.editable.features!.map((f) => f.label)).toEqual(["Paint finish"]);
    expect(data.editable.rates!.sections[0].groups[0].featureIds).toEqual([]);
  });

  it("a new section gets the default commission and bonus slabs are saved", async () => {
    const t = await tree();
    const data = await edit(t.digital.id, (p) => {
      p.rates!.sections.push(section("Flex", "FLEX", [group("Flex", [button("240 GSM", "45")])], { commission: "", bonusSlabs: [{ minSqft: "500", bonus: "1000" }] }));
    });
    expect(data.editable.rates!.sections[0]).toMatchObject({ commission: "5", bonusSlabs: [{ minSqft: "500", bonus: "1000" }] });
    await expect(edit(t.digital.id, (p) => void (p.rates!.sections[0].bonusSlabs = [{ minSqft: "", bonus: "50" }]))).rejects.toThrow(/needs the sq ft/);
  });
});

const customer = { name: "Bilal Ahmed", phone: "0300 7654321", city: "Model Town, Lahore", note: "" };

async function affiliate() {
  const user = await registerUser({ name: "Ayesha Khan", email: "ayesha@example.com", password: "password123", phone: undefined });
  const a = await applyAsAffiliate(user.id, { payoutMethod: "JAZZCASH", payoutAccount: "+923001234567", payoutAccountName: "Ayesha Khan", website: null, promotionPlan: "Instagram" });
  await setAffiliateStatus(a.id, "APPROVED");
  return a;
}

async function variantId(label: string) {
  const v = await prisma.rateVariant.findFirstOrThrow({ where: { label }, select: { id: true, itemId: true } });
  return { itemId: v.itemId, variantId: v.id };
}

describe("Order now: per-sq-ft commission, per-button rule, 3D Wallpaper", () => {
  it("commission = billable sq ft × Rs 5 (flex), none on designing charges, Pending → Approved when paid", async () => {
    await digitalWithRates();
    const a = await affiliate();
    const input = rateOrderSchema.parse({ ...(await variantId("240 GSM")), unit: "ft-in", width: { value: 10, inches: 3 }, height: { value: 5 }, ...customer });
    const result = await placeRateOrder(input, { referralCode: a.code });
    if (!result.ok) throw new Error(result.error);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { commission: true } });
    expect(order.totalMinor).toBe(347_500); // 55 × 45 + 1,000
    expect(order.commission).toMatchObject({ status: "PENDING", amountMinor: 27_500 }); // 55 sq ft × Rs 5
    // A discount (a lower agreed total) never reduces it
    await setOrderTotal(order.id, 300_000);
    expect((await prisma.affiliateCommission.findUniqueOrThrow({ where: { orderId: order.id } })).amountMinor).toBe(27_500);
    await updateOrderStatus(order.id, "FULLY_PAID", null);
    expect((await prisma.affiliateCommission.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("APPROVED");
  });

  it("big-order bonus is added as its own line", async () => {
    const t = await digitalWithRates();
    await edit(t.digital.id, (p) => void (p.rates!.sections[2].bonusSlabs = [{ minSqft: "50", bonus: "1000" }]));
    const a = await affiliate();
    // Vinyl 1000 Series, 9 ft 1 in × 6 ft 2 in = 83.25 sq ft × Rs 10 = Rs 832.50 + Rs 1,000 bonus
    const input = rateOrderSchema.parse({ ...(await variantId("1000 Series")), unit: "ft-in", width: { value: 9, inches: 1 }, height: { value: 6, inches: 2 }, ...customer });
    const result = await placeRateOrder(input, { referralCode: a.code });
    if (!result.ok) throw new Error(result.error);
    const c = await prisma.affiliateCommission.findFirstOrThrow({ where: { order: { number: result.number } } });
    expect(c.amountMinor).toBe(83_250 + 100_000);
    expect(c.breakdown).toEqual([expect.objectContaining({ perSqft: true, sqft: 83.25, commissionMinor: 83_250 }), expect.objectContaining({ bonus: true, commissionMinor: 100_000 })]);
  });

  it("Reflective Flex 400 GSM uses the Sticker rule; other flex buttons keep the Flex rule", async () => {
    await digitalWithRates();
    const size = { unit: "ft-in", width: { value: 3 }, height: { value: 6 }, ...customer };
    const reflective = await placeRateOrder(rateOrderSchema.parse({ ...(await variantId("Reflective Flex 400 GSM")), ...size }), { referralCode: null });
    const china = await placeRateOrder(rateOrderSchema.parse({ ...(await variantId("China Flex 240 GSM")), ...size }), { referralCode: null });
    if (!reflective.ok || !china.ok) throw new Error("order failed");
    expect(decodeURIComponent(reflective.whatsappUrl)).toContain("Billable area: 27 sq ft"); // 4.5 × 6
    expect(decodeURIComponent(china.whatsappUrl)).toContain("Billable area: 18 sq ft"); // 3 × 6
  });

  it("3D Wallpaper: fitting on its own line, the design code in the order and WhatsApp", async () => {
    const t = await tree();
    const wall = await prisma.category.create({ data: { name: "3D Wallpaper", slug: "3d-wallpaper", parentId: t.digital.id } });
    await edit(wall.id, (p) => {
      p.rates!.sections.push(section("3D Wallpaper Types & Rate per sq ft (Rs)", "FLEX", [group("3D Wallpaper", [button("Premium", "120")])], { hasFitting: true, fittingRate: "30", askDesignCode: true }));
    });
    await prisma.wallpaperDesign.create({ data: { code: "WP-012", title: "Marble", imageUrl: "/x.webp", imageKey: "x" } });
    const base = { ...(await variantId("Premium")), unit: "ft-in", width: { value: 10, inches: 3 }, height: { value: 8 }, ...customer };
    const result = await placeRateOrder(rateOrderSchema.parse({ ...base, designCode: "wp-012" }), { referralCode: null });
    if (!result.ok) throw new Error(result.error);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { items: { orderBy: { lineTotalMinor: "desc" } } } });
    expect(order.totalMinor).toBe(1_420_000); // 88 × (120 + 30) + 1,000
    expect(order.items.map((i) => [i.productName, i.lineTotalMinor])).toEqual([
      ["3D Wallpaper Premium (Design WP-012)", 1_056_000],
      ["Fitting", 264_000],
      ["Designing charges", 100_000],
    ]);
    expect(decodeURIComponent(result.whatsappUrl)).toContain("Design: WP-012");
    const noFit = await placeRateOrder(rateOrderSchema.parse({ ...base, includeFitting: false }), { referralCode: null });
    if (!noFit.ok) throw new Error(noFit.error);
    expect((await prisma.order.findUniqueOrThrow({ where: { number: noFit.number } })).totalMinor).toBe(1_156_000);
    expect((await placeRateOrder(rateOrderSchema.parse({ ...base, designCode: "WP-999" }), { referralCode: null })).ok).toBe(false);
  });

  it("designing charges come from the calculator settings", async () => {
    await digitalWithRates();
    await saveRateSettings((() => { const f = new FormData(); f.set("designCharge", "1,500"); f.set("minOrder", ""); return f; })());
    expect((await readRateSettings()).designChargeMinor).toBe(150_000);
    const result = await placeRateOrder(rateOrderSchema.parse({ ...(await variantId("240 GSM")), unit: "ft-in", width: { value: 4 }, height: { value: 3 }, ...customer }), { referralCode: null });
    if (!result.ok) throw new Error(result.error);
    expect((await prisma.order.findUniqueOrThrow({ where: { number: result.number } })).totalMinor).toBe(12 * 4500 + 150_000);
  });
});

describe("buttons created by the November data move (long ids)", () => {
  it("can be edited and ordered", async () => {
    const t = await digitalWithRates();
    const longId = `ratesec_ratepage_digital_flex_famous_ratevar_${"x".repeat(40)}`;
    const famous = await prisma.rateItem.findFirstOrThrow({ where: { name: "Most Famous Flex Names" } });
    await prisma.rateVariant.create({ data: { id: longId, itemId: famous.id, label: "Panaflex", rateMinor: 7000, sortOrder: 5 } });
    await edit(t.digital.id, (p) => {
      p.rates!.sections[0].groups[1].buttons.find((b) => b.id === longId)!.rate = "72";
    });
    expect((await prisma.rateVariant.findUniqueOrThrow({ where: { id: longId } })).rateMinor).toBe(7200);
    const result = await placeRateOrder(rateOrderSchema.parse({ itemId: famous.id, variantId: longId, unit: "ft-in", width: { value: 4 }, height: { value: 3 }, ...customer }), { referralCode: null });
    expect(result.ok).toBe(true);
  });
});
