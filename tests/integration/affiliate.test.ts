import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  AffiliateError,
  applyAsAffiliate,
  approveCommission,
  approveDueCommissions,
  createCommissionForOrder,
  getAffiliateStats,
  markWithdrawalPaid,
  onOrderStatusChanged,
  recordClick,
  rejectWithdrawal,
  requestWithdrawal,
  setAffiliateRate,
  setAffiliateStatus,
  updateAffiliateSettings,
} from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { createTestProduct, resetDatabase } from "../support/db";

const payout = { payoutMethod: "JAZZCASH" as const, payoutAccount: "+923001234567", payoutAccountName: "Ayesha Khan" };
let n = 0;
const newUser = (name = "Ayesha Khan") =>
  registerUser({ name, email: `user${++n}@example.com`, password: "password123", phone: undefined });

async function approvedAffiliate() {
  const user = await newUser();
  const affiliate = await applyAsAffiliate(user.id, { ...payout, website: null, promotionPlan: "Instagram page" });
  await setAffiliateStatus(affiliate.id, "APPROVED");
  return { user, affiliate };
}

/** Simulates checkout: an order with items (lineTotal in paisa). */
async function placeOrder(userId: string, lines: { productId?: string; total: number }[], extra: { discountMinor?: number } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  return prisma.order.create({
    data: {
      number: `MP-${++n}`,
      userId,
      subtotalMinor: subtotal,
      discountMinor: extra.discountMinor ?? 0,
      shippingMinor: 25_000,
      totalMinor: subtotal - (extra.discountMinor ?? 0) + 25_000,
      shippingAddress: {},
      items: {
        create: lines.map((l) => ({
          productId: l.productId ?? null,
          productName: "Item",
          optionsSummary: [],
          quantity: 1,
          unitPriceMinor: l.total,
          lineTotalMinor: l.total,
        })),
      },
    },
  });
}

beforeEach(resetDatabase);

describe("joining", () => {
  it("creates a pending affiliate with a readable unique code", async () => {
    const user = await newUser();
    const a = await applyAsAffiliate(user.id, { ...payout, website: "https://instagram.com/x", promotionPlan: "Instagram page" });
    expect(a.status).toBe("PENDING");
    expect(a.code).toMatch(/^AYESHA[A-Z2-9]{4}$/);
    await expect(applyAsAffiliate(user.id, { ...payout, website: null, promotionPlan: "again please" })).rejects.toThrow(AffiliateError);
  });

  it("auto-approves when the program is set to, and lets rejected applicants reapply", async () => {
    await updateAffiliateSettings({ defaultRateBps: 500, cookieDays: 30, minWithdrawalMinor: 100_000, holdDays: 7, autoApprove: true });
    const user = await newUser();
    const a = await applyAsAffiliate(user.id, { ...payout, website: null, promotionPlan: "WhatsApp groups" });
    expect(a.status).toBe("APPROVED");
    expect(a.approvedAt).not.toBeNull();

    await setAffiliateStatus(a.id, "REJECTED", "Not a fit");
    const again = await applyAsAffiliate(user.id, { ...payout, website: null, promotionPlan: "Facebook page now" });
    expect(again.id).toBe(a.id);
    expect(again.adminNote).toBeNull();
  });
});

describe("clicks", () => {
  it("records clicks for approved affiliates only, once per IP per 30 minutes", async () => {
    const { affiliate } = await approvedAffiliate();
    const t = new Date("2026-10-30T10:00:00Z");
    expect(await recordClick(affiliate.code.toLowerCase(), { landingPath: "/", ip: "1.2.3.4" }, t)).not.toBeNull();
    await recordClick(affiliate.code, { landingPath: "/", ip: "1.2.3.4" }, new Date(t.getTime() + 10 * 60_000));
    await recordClick(affiliate.code, { landingPath: "/", ip: "5.6.7.8" }, t);
    await recordClick(affiliate.code, { landingPath: "/", ip: "1.2.3.4" }, new Date(t.getTime() + 31 * 60_000));
    const clicks = await prisma.affiliateClick.findMany({ where: { affiliateId: affiliate.id } });
    expect(clicks).toHaveLength(3);
    expect(clicks.every((c) => c.ipHash && !c.ipHash.includes("1.2.3.4"))).toBe(true);

    await setAffiliateStatus(affiliate.id, "SUSPENDED", "Spam");
    expect(await recordClick(affiliate.code, { landingPath: "/", ip: "9.9.9.9" })).toBeNull();
    expect(await recordClick("NOSUCHCODE", { landingPath: "/" })).toBeNull();
  });
});

describe("commissions", () => {
  it("calculates from order items with product-specific rates and links the order", async () => {
    const { affiliate } = await approvedAffiliate();
    const buyer = await newUser("Bilal");
    const special = await createTestProduct();
    await prisma.product.update({ where: { id: special.id }, data: { affiliateCommissionBps: 1000 } });
    const order = await placeOrder(buyer.id, [{ productId: special.id, total: 100_000 }, { total: 50_000 }]);

    const c = await createCommissionForOrder(order.id, affiliate.code);
    // 10% of 1,000 + 5% (default) of 500; shipping excluded
    expect(c).toMatchObject({ status: "PENDING", baseAmountMinor: 150_000, amountMinor: 12_500 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).affiliateId).toBe(affiliate.id);
    // idempotent
    expect((await createCommissionForOrder(order.id, affiliate.code))?.id).toBe(c?.id);
  });

  it("uses an affiliate's custom rate and ignores invalid, inactive and self referrals", async () => {
    const { user, affiliate } = await approvedAffiliate();
    await setAffiliateRate(affiliate.id, 800);
    const buyer = await newUser("Bilal");
    expect((await createCommissionForOrder((await placeOrder(buyer.id, [{ total: 100_000 }])).id, affiliate.code))?.amountMinor).toBe(8_000);

    expect(await createCommissionForOrder((await placeOrder(user.id, [{ total: 100_000 }])).id, affiliate.code)).toBeNull();
    expect(await createCommissionForOrder((await placeOrder(buyer.id, [{ total: 100_000 }])).id, "BADCODE1")).toBeNull();
    expect(await createCommissionForOrder((await placeOrder(buyer.id, [{ total: 100_000 }])).id, null)).toBeNull();
    await setAffiliateStatus(affiliate.id, "SUSPENDED");
    expect(await createCommissionForOrder((await placeOrder(buyer.id, [{ total: 100_000 }])).id, affiliate.code)).toBeNull();
  });

  it("reverses commissions for cancelled or refunded orders", async () => {
    const { affiliate } = await approvedAffiliate();
    const buyer = await newUser("Bilal");
    const order = await placeOrder(buyer.id, [{ total: 100_000 }]);
    const c = await createCommissionForOrder(order.id, affiliate.code);
    await onOrderStatusChanged(order.id, "SHIPPED");
    expect((await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: c!.id } })).status).toBe("PENDING");
    await onOrderStatusChanged(order.id, "CANCELLED");
    expect(await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: c!.id } })).toMatchObject({
      status: "REVERSED",
      note: "Order cancelled",
    });
  });

  it("approves delivered orders only after the hold period", async () => {
    const { affiliate } = await approvedAffiliate();
    const buyer = await newUser("Bilal");
    const order = await placeOrder(buyer.id, [{ total: 100_000 }]);
    await createCommissionForOrder(order.id, affiliate.code);
    const deliveredAt = new Date("2026-10-01T00:00:00Z");
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await prisma.orderStatusEvent.create({ data: { orderId: order.id, status: "DELIVERED", createdAt: deliveredAt } });

    expect(await approveDueCommissions(new Date("2026-10-05T00:00:00Z"))).toBe(0); // 4 days < 7
    expect(await approveDueCommissions(new Date("2026-10-09T00:00:00Z"))).toBe(1);
    expect((await prisma.affiliateCommission.findFirstOrThrow()).status).toBe("APPROVED");
  });
});

describe("withdrawals", () => {
  async function earned(amounts: number[]) {
    const ctx = await approvedAffiliate();
    const buyer = await newUser("Bilal");
    for (const total of amounts) {
      const c = await createCommissionForOrder((await placeOrder(buyer.id, [{ total }])).id, ctx.affiliate.code);
      await approveCommission(c!.id);
    }
    return ctx;
  }

  it("enforces the minimum and pays out the whole available balance", async () => {
    const small = await earned([1_000_000]); // 5% = PKR 500 < PKR 1,000 minimum
    await expect(requestWithdrawal(small.user.id)).rejects.toThrow(/minimum withdrawal is PKR 1,000/);

    const { user, affiliate } = await earned([2_000_000, 2_000_000]); // 2 × PKR 1,000
    const w = await requestWithdrawal(user.id);
    expect(w).toMatchObject({ amountMinor: 200_000, method: "JAZZCASH", account: "+923001234567", status: "REQUESTED" });
    await expect(requestWithdrawal(user.id)).rejects.toThrow(/already have a withdrawal/);

    let stats = await getAffiliateStats(affiliate.id);
    expect(stats).toMatchObject({ availableMinor: 0, processingMinor: 200_000, paidMinor: 0 });

    await expect(markWithdrawalPaid(w.id, "")).rejects.toThrow(/transaction reference/);
    await expect(markWithdrawalPaid(w.id, "JC-1", { paidAt: new Date(Date.now() + 3 * 86_400_000) })).rejects.toThrow(/not in the future/);
    await markWithdrawalPaid(w.id, "JC-889911", { paidAt: new Date("2026-10-01T12:00:00+05:00"), method: "BANK_TRANSFER" });
    expect(await prisma.affiliateWithdrawal.findUniqueOrThrow({ where: { id: w.id } })).toMatchObject({
      paidMethod: "BANK_TRANSFER",
      processedAt: new Date("2026-10-01T07:00:00Z"),
    });
    stats = await getAffiliateStats(affiliate.id);
    expect(stats).toMatchObject({ availableMinor: 0, processingMinor: 0, paidMinor: 200_000, orders: 2 });
    await expect(markWithdrawalPaid(w.id, "again")).rejects.toThrow(/already been processed/);
  });

  it("returns the balance when a withdrawal is rejected", async () => {
    const { user, affiliate } = await earned([3_000_000]);
    const w = await requestWithdrawal(user.id);
    await rejectWithdrawal(w.id, "Account title does not match");
    expect((await getAffiliateStats(affiliate.id)).availableMinor).toBe(150_000);
    expect((await requestWithdrawal(user.id)).amountMinor).toBe(150_000);
  });

  it("removes a reversed commission from a pending withdrawal", async () => {
    const { user } = await earned([2_000_000, 4_000_000]);
    const w = await requestWithdrawal(user.id);
    expect(w.amountMinor).toBe(300_000);
    const first = await prisma.affiliateCommission.findFirstOrThrow({ where: { amountMinor: 100_000 } });
    await onOrderStatusChanged(first.orderId, "REFUNDED");
    expect((await prisma.affiliateWithdrawal.findUniqueOrThrow({ where: { id: w.id } })).amountMinor).toBe(200_000);
  });

  it("requires payout details and an active account", async () => {
    const user = await newUser();
    await expect(requestWithdrawal(user.id)).rejects.toThrow(/Join the affiliate program/);
    const pending = await applyAsAffiliate(user.id, { ...payout, website: null, promotionPlan: "Instagram page" });
    expect(pending.status).toBe("PENDING");
    await expect(requestWithdrawal(user.id)).rejects.toThrow(/not active/);
  });
});
