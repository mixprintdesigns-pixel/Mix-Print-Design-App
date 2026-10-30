import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyAsAffiliate, getAffiliateStats, setAffiliateStatus } from "@/lib/affiliate/service";
import { registerUser } from "@/lib/auth/service";
import type { Email } from "@/lib/email";
import { addOrderPhoto, findOrderForTracking, recordOrderSchema, recordWhatsAppOrder, updateOrderStatus } from "@/lib/orders/manual";
import sharp from "sharp";
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
    expect(saved).toMatchObject({ source: "WHATSAPP", userId: null, customerName: "Bilal Ahmed", status: "PENDING_PAYMENT", totalMinor: 450_000, amountPaidMinor: 0 });
    expect(saved.items[0]).toMatchObject({ productName: "Business cards, matte, 1000", quantity: 1000, lineTotalMinor: 450_000 });
    expect(saved.statusEvents.map((e) => e.status)).toEqual(["PENDING_PAYMENT"]);
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

  it("runs the 50% advance flow; the commission is approved only at Fully Paid", async () => {
    const affiliate = await approvedAffiliate();
    const sent: Email[] = [];
    const transport = async (email: Email) => {
      sent.push(email);
      return { sent: true as const };
    };
    const { orderId, number } = await recordWhatsAppOrder(order({ referralCode: affiliate.code, customerEmail: "bilal@example.com" }), null);
    const commission = () => prisma.affiliateCommission.findUniqueOrThrow({ where: { orderId } });
    const paid = async () => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).amountPaidMinor;

    await updateOrderStatus(orderId, "ADVANCE_RECEIVED", null, {}, transport);
    expect(await paid()).toBe(225_000); // 50% of PKR 4,500
    await updateOrderStatus(orderId, "IN_PROGRESS", null, {}, transport);
    expect((await commission()).status).toBe("PENDING");

    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#00afef" } }).png().toBuffer();
    const photo = await addOrderPhoto(orderId, new Uint8Array(png));
    expect(photo.storageKey).toMatch(/finished-work-mix-print-design-[0-9a-f]{6}\.webp$/);
    const done = await updateOrderStatus(orderId, "WORK_COMPLETED", null, {}, transport);
    expect(done.emailed).toBe(true);
    expect(sent[0]).toMatchObject({ to: "bilal@example.com" });
    expect(sent[0].text).toContain("Remaining balance: PKR 2,250");
    expect(sent[0].text).toContain(photo.url);
    expect(decodeURIComponent(done.whatsappLink!)).toMatch(/^https:\/\/wa\.me\/923007654321\?text=[\s\S]*Remaining balance: PKR 2,250/);
    expect((await commission()).status).toBe("PENDING");

    await updateOrderStatus(orderId, "FULLY_PAID", null, {}, transport);
    expect(await paid()).toBe(450_000);
    expect((await commission()).status).toBe("APPROVED");

    // The customer can track it with the order number and their phone.
    const tracked = await findOrderForTracking(number.toLowerCase(), "+92 300 7654321");
    expect(tracked).toMatchObject({ status: "FULLY_PAID", amountPaidMinor: 450_000 });
    expect(tracked).not.toHaveProperty("customerPhone");
    expect(await findOrderForTracking(number, "0311 0000000")).toBeNull();
  });
});
