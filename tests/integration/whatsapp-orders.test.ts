import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, getAffiliateStats, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import { recordOrderSchema, recordWhatsAppOrder, updateOrderStatus } from "@/lib/orders/manual";
import { createTestProduct, resetDatabase } from "../support/db";

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

const order = (overrides: Record<string, unknown> = {}) =>
  recordOrderSchema.parse({
    customerName: "Bilal Ahmed",
    customerPhone: "0300 7654321",
    referralCode: "",
    notes: "",
    items: [{ productId: "", description: "Business cards, matte, 1000", quantity: "1000", total: "4500" }],
    ...overrides,
  });

describe("WhatsApp orders recorded by staff", () => {
  it("saves the order without a website account", async () => {
    const result = await recordWhatsAppOrder(order(), null);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true, statusEvents: true } });
    expect(saved).toMatchObject({ source: "WHATSAPP", userId: null, customerName: "Bilal Ahmed", status: "CONFIRMED", totalMinor: 450_000 });
    expect(saved.items[0]).toMatchObject({ productName: "Business cards, matte, 1000", quantity: 1000, lineTotalMinor: 450_000 });
    expect(saved.statusEvents.map((e) => e.status)).toEqual(["CONFIRMED"]);
    expect(result.commission).toBe("none");
  });

  it("gives the affiliate a commission and counts the conversion; cancelling reverses it", async () => {
    const affiliate = await approvedAffiliate();
    const product = await createTestProduct();
    const result = await recordWhatsAppOrder(
      order({ referralCode: affiliate.code.toLowerCase(), items: [{ productId: product.id, description: "Cards", quantity: "500", total: "1000" }] }),
      null,
    );
    expect(result.commission).toBe("created");
    const commission = await prisma.affiliateCommission.findUniqueOrThrow({ where: { orderId: result.orderId } });
    expect(commission).toMatchObject({ affiliateId: affiliate.id, status: "PENDING", baseAmountMinor: 100_000 });
    expect((await getAffiliateStats(affiliate.id)).orders).toBe(1);

    await updateOrderStatus(result.orderId, "CANCELLED", null);
    expect((await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe("REVERSED");
  });

  it("records the order but no commission for an unknown code, and validates input", async () => {
    expect((await recordWhatsAppOrder(order({ referralCode: "NOPE1234" }), null)).commission).toBe("invalid-code");
    expect(recordOrderSchema.safeParse({ ...order(), items: [] }).success).toBe(false);
    expect(recordOrderSchema.safeParse({ customerName: "B", customerPhone: "1", referralCode: "", notes: "", items: [{ productId: "", description: "x", quantity: "0", total: "abc" }] }).success).toBe(false);
  });
});
