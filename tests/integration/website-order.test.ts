import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, getAffiliateStats, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { recordPayment } from "@/lib/admin-sections/payments";
import { updateOrderStatus } from "@/lib/orders/manual";
import { confirmationTokenMatches, getOrderConfirmation, placeWebsiteOrder, websiteOrderSchema } from "@/lib/orders/website-order";
import { createTestProduct, resetDatabase } from "../support/db";

// "Order now": the order is saved before WhatsApp opens, with the affiliate and a Pending commission.

beforeEach(resetDatabase);

async function approvedAffiliate() {
  const user = await registerUser({ name: "Ayesha Khan", email: "ayesha@example.com", password: "password123", phone: undefined });
  const affiliate = await applyAsAffiliate(user.id, {
    payoutMethod: "JAZZCASH",
    payoutAccount: "+923001234567",
    payoutAccountName: "Ayesha Khan",
    website: null,
    promotionPlan: "Instagram page",
  });
  await setAffiliateStatus(affiliate.id, "APPROVED");
  return affiliate;
}

async function orderInput(quantity = 500, picks: [number, number] = [1, 1]) {
  const product = await createTestProduct();
  const optionValueIds = product.options.map((o, i) => o.values[picks[i]].id);
  return {
    product,
    input: websiteOrderSchema.parse({ productId: product.id, optionValueIds, quantity, name: "Bilal Ahmed", phone: "0300 7654321", city: "Model Town, Lahore", note: "Logo on both sides" }),
  };
}

describe("Order now", () => {
  it("saves the order with the server's price, options and customer details, Pending and unpaid", async () => {
    // 500 cards: tier Rs 2.50 + Gloss Rs 0.50 + Double Rs 1.00 = Rs 4.00 × 500 = Rs 2,000
    const { product, input } = await orderInput();
    const result = await placeWebsiteOrder(input, { referralCode: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { items: true, commission: true } });
    expect(order).toMatchObject({ source: "WEBSITE", status: "PENDING_PAYMENT", amountPaidMinor: 0, totalMinor: 200_000, customerName: "Bilal Ahmed", customerPhone: "0300 7654321", customerNotes: "Logo on both sides", affiliateId: null });
    expect(order.shippingAddress).toMatchObject({ address: "Model Town, Lahore" });
    expect(order.items[0]).toMatchObject({ productId: product.id, quantity: 500, lineTotalMinor: 200_000 });
    expect(order.items[0].optionsSummary).toEqual([
      { option: "Paper", value: "Gloss" },
      { option: "Sides", value: "Double" },
    ]);
    expect(order.commission).toBeNull();

    const message = decodeURIComponent(result.whatsappUrl.split("?text=")[1]);
    expect(message).toMatch(new RegExp(`^Assalam o Alaikum! Order #${result.number}\\n\\*Test Cards\\*\\nPaper: Gloss\\nSides: Double\\nQuantity: 500\\nTotal: PKR 2,000`));
    expect(message).not.toContain("Ref:");
  });

  it("attaches the affiliate from the referral code with a Pending commission (fixed rupees first, else %)", async () => {
    const affiliate = await approvedAffiliate();
    const { product, input } = await orderInput();
    await prisma.product.update({ where: { id: product.id }, data: { affiliateCommissionMinor: 20_000, affiliateCommissionBps: 1000 } });
    const result = await placeWebsiteOrder(input, { referralCode: affiliate.code.toLowerCase() });
    if (!result.ok) throw new Error(result.error);
    expect(result.affiliateCode).toBe(affiliate.code);
    expect(decodeURIComponent(result.whatsappUrl)).toMatch(new RegExp(`Ref: ${affiliate.code}$`));
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.number }, include: { commission: true } });
    expect(order.affiliateId).toBe(affiliate.id);
    expect(order.commission).toMatchObject({ status: "PENDING", amountMinor: 20_000 }); // Rs 200 per order
    expect((await getAffiliateStats(affiliate.id)).orders).toBe(1);

    // With no rupee amount, the percentage is used: 10% of Rs 2,000 = Rs 200 as well; use 5% to tell them apart
    await prisma.product.update({ where: { id: product.id }, data: { affiliateCommissionMinor: null, affiliateCommissionBps: 500 } });
    const second = await placeWebsiteOrder(input, { referralCode: affiliate.code });
    if (!second.ok) throw new Error(second.error);
    expect((await prisma.order.findUniqueOrThrow({ where: { number: second.number }, include: { commission: true } })).commission).toMatchObject({ amountMinor: 10_000 });
  });

  it("approves the commission when the order is paid in full (Payments or Fully Paid) and cancels it with the order", async () => {
    const affiliate = await approvedAffiliate();
    const { input } = await orderInput();
    const viaPayments = await placeWebsiteOrder(input, { referralCode: affiliate.code });
    const viaStatus = await placeWebsiteOrder(input, { referralCode: affiliate.code });
    const cancelled = await placeWebsiteOrder(input, { referralCode: affiliate.code });
    if (!viaPayments.ok || !viaStatus.ok || !cancelled.ok) throw new Error("order failed");
    const commissionOf = async (number: string) => (await prisma.order.findUniqueOrThrow({ where: { number }, include: { commission: true } })).commission!.status;
    const idOf = async (number: string) => (await prisma.order.findUniqueOrThrow({ where: { number } })).id;

    await recordPayment({ orderNumber: viaPayments.number, amountMinor: 100_000, method: "JAZZCASH", receivedAt: new Date() }, null);
    expect(await commissionOf(viaPayments.number)).toBe("PENDING"); // 50% advance only
    await recordPayment({ orderNumber: viaPayments.number, amountMinor: 100_000, method: "CASH", receivedAt: new Date() }, null);
    expect(await commissionOf(viaPayments.number)).toBe("APPROVED");

    await updateOrderStatus(await idOf(viaStatus.number), "FULLY_PAID", null);
    expect(await commissionOf(viaStatus.number)).toBe("APPROVED");

    await updateOrderStatus(await idOf(cancelled.number), "CANCELLED", null);
    expect(await commissionOf(cancelled.number)).toBe("REVERSED");
  });

  it("ignores unknown codes and refuses wrong quantities, options or unavailable products", async () => {
    const { product, input } = await orderInput();
    const unknown = await placeWebsiteOrder(input, { referralCode: "NOPE1234" });
    expect(unknown).toMatchObject({ ok: true, affiliateCode: null });

    expect(await placeWebsiteOrder({ ...input, quantity: 150 }, { referralCode: null })).toMatchObject({ ok: false });
    expect(await placeWebsiteOrder({ ...input, optionValueIds: [] }, { referralCode: null })).toMatchObject({ ok: false });
    await prisma.product.update({ where: { id: product.id }, data: { isAvailable: false } });
    expect(await placeWebsiteOrder(input, { referralCode: null })).toMatchObject({ ok: false, error: /not available/ });
    expect(websiteOrderSchema.safeParse({ ...input, phone: "123" }).success).toBe(false);
  });

  it("shows the confirmation only with the right link", async () => {
    const { input } = await orderInput();
    const result = await placeWebsiteOrder(input, { referralCode: null });
    if (!result.ok) throw new Error(result.error);
    const token = new URLSearchParams(result.confirmationPath.split("?")[1]).get("t")!;
    expect(confirmationTokenMatches(result.number, token)).toBe(true);
    const view = await getOrderConfirmation(result.number, token);
    expect(view).toMatchObject({ number: result.number, totalMinor: 200_000, items: [{ productName: "Test Cards", quantity: 500 }] });
    expect(view!.whatsappUrl).toBe(result.whatsappUrl);
    expect(await getOrderConfirmation(result.number, "wrong-token")).toBeNull();
  });
});
