import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { chatOrderSchema, placeChatOrder } from "@/lib/orders/chat-order";
import { setOrderTotal } from "@/lib/orders/manual";
import { createTestProduct, resetDatabase } from "../support/db";

beforeEach(resetDatabase);

async function approvedAffiliate() {
  const user = await registerUser({ name: "Sana Malik", email: "sana@example.com", password: "password123", phone: undefined });
  const affiliate = await applyAsAffiliate(user.id, {
    payoutMethod: "EASYPAISA",
    payoutAccount: "+923001112233",
    payoutAccountName: "Sana Malik",
    website: null,
    promotionPlan: "Facebook groups",
  });
  await setAffiliateStatus(affiliate.id, "APPROVED");
  return affiliate;
}

const input = (productId: string, extra: Record<string, unknown> = {}) =>
  chatOrderSchema.parse({ productId, quantity: "500", name: "Hamza Ali", phone: "0321 7654321", requirements: "Logo on front, matte finish", ...extra });

describe("orders from the AI chat", () => {
  it("saves a Pending chat order with an estimated total and the affiliate code", async () => {
    const affiliate = await approvedAffiliate();
    const product = await createTestProduct(); // PKR 3.00/unit, PKR 2.50 from 500
    await prisma.product.update({ where: { id: product.id }, data: { affiliateCommissionMinor: 20_000 } });

    const result = await placeChatOrder(input(product.id), affiliate.code);
    expect(result).toMatchObject({ ok: true, totalMinor: 125_000 });
    const order = await prisma.order.findFirstOrThrow({ include: { items: true, commission: true } });
    expect(order).toMatchObject({ source: "CHAT", status: "PENDING_PAYMENT", customerName: "Hamza Ali", affiliateId: affiliate.id });
    expect(order.customerNotes).toContain("Logo on front");
    expect(order.commission).toMatchObject({ amountMinor: 20_000, status: "PENDING" }); // Rs 200 fixed

    // Staff agree the final price: the order and a %-based commission follow it.
    await prisma.product.update({ where: { id: product.id }, data: { affiliateCommissionMinor: null, affiliateCommissionBps: 1000 } });
    await setOrderTotal(order.id, 200_000);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, commission: true } });
    expect(updated.totalMinor).toBe(200_000);
    expect(updated.items[0].lineTotalMinor).toBe(200_000);
    expect(updated.commission!.amountMinor).toBe(20_000); // 10% of PKR 2,000
  });

  it("works without an affiliate and rejects unavailable products or bad details", async () => {
    const product = await createTestProduct({ status: "DRAFT" });
    expect(await placeChatOrder(input(product.id), null)).toMatchObject({ ok: false });
    expect(chatOrderSchema.safeParse({ productId: "x", quantity: "1", name: "A", phone: "12", requirements: "" }).success).toBe(false);
    const live = await createTestProduct();
    expect(await placeChatOrder(input(live.id, { quantity: "1" }), null)).toMatchObject({ ok: true, totalMinor: 30_000 }); // raised to the minimum 100
  });
});
