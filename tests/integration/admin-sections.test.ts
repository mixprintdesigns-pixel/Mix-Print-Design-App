import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { recordOrderSchema, recordWhatsAppOrder, updateOrderStatus } from "@/lib/orders/manual";
import { addDesignProof, addOrderToDesignWork, checkProofFile, getApprovalView, respondToProof } from "@/lib/admin-sections/design-work";
import { getCustomer, listCustomers, saveCustomerNote } from "@/lib/admin-sections/customers";
import { amountReceived, listOrderPayments, paymentState, recordPayment } from "@/lib/admin-sections/payments";
import { salesByDay, salesByMonth, topProducts, unpaidBalances } from "@/lib/admin-sections/reports";
import { karachiDateToUtc } from "@/lib/admin-sections/shared";
import { resetDatabase } from "../support/db";

beforeEach(resetDatabase);

async function whatsappOrder(name = "Bilal Ahmed", phone = "0300 7654321", total = "4500", description = "Business cards") {
  const input = recordOrderSchema.parse({
    customerName: name,
    customerPhone: phone,
    referralCode: "",
    notes: "",
    items: [{ productId: "", description, quantity: "100", total }],
  });
  const { orderId } = await recordWhatsAppOrder(input, null);
  return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

const png = () => sharp({ create: { width: 20, height: 20, channels: 3, background: "#00AFEF" } }).png().toBuffer().then((b) => new Uint8Array(b));

describe("design work", () => {
  it("adds an order once, uploads proofs and takes the customer's answer", async () => {
    const order = await whatsappOrder();
    const { job, created } = await addOrderToDesignWork(order.number.toLowerCase(), "Logo in gold");
    expect(created).toBe(true);
    expect((await addOrderToDesignWork(order.number)).created).toBe(false);

    const v1 = await addDesignProof(job.id, { bytes: await png(), name: "v1.png" }, "First draft");
    expect(v1.version).toBe(1);
    expect((await prisma.designJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("SENT_FOR_APPROVAL");

    await expect(respondToProof(job.approvalToken, v1.id, "CHANGES_REQUESTED", "  ")).rejects.toThrow(/what to change/);
    await respondToProof(job.approvalToken, v1.id, "CHANGES_REQUESTED", "Bigger phone number");
    expect((await prisma.designJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("IN_PROGRESS");
    await expect(respondToProof(job.approvalToken, v1.id, "APPROVED", "")).rejects.toThrow();

    const v2 = await addDesignProof(job.id, { bytes: await png(), name: "v2.png" });
    expect(v2.version).toBe(2);
    await expect(respondToProof(job.approvalToken, v1.id, "APPROVED", "")).rejects.toThrow(/newer design/);
    await respondToProof(job.approvalToken, v2.id, "APPROVED", "");

    const view = await getApprovalView(job.approvalToken);
    expect(view).toMatchObject({ status: "APPROVED", orderNumber: order.number });
    expect(view!.proofs.map((p) => [p.version, p.response])).toEqual([
      [2, "APPROVED"],
      [1, "CHANGES_REQUESTED"],
    ]);
    expect(await getApprovalView("not-a-real-token-at-all-123")).toBeNull();
  });

  it("accepts images and PDFs only", () => {
    expect(checkProofFile(new TextEncoder().encode("%PDF-1.7 rest"))).toMatchObject({ ok: true, type: "application/pdf" });
    expect(checkProofFile(new TextEncoder().encode("<svg></svg>"))).toMatchObject({ ok: false });
  });
});

describe("payments", () => {
  it("records payments and works out Paid / Partial / Unpaid without double counting", async () => {
    const order = await whatsappOrder();
    expect((await listOrderPayments())[0]).toMatchObject({ state: "UNPAID", balanceMinor: 450_000 });

    await recordPayment({ orderNumber: order.number, amountMinor: 200_000, method: "JAZZCASH", receivedAt: new Date() }, null);
    expect((await listOrderPayments("PARTIAL"))[0]).toMatchObject({ receivedMinor: 200_000, balanceMinor: 250_000 });

    // The Orders screen records the 50% advance too: the larger amount is used, not the sum.
    await updateOrderStatus(order.id, "ADVANCE_RECEIVED", null);
    expect((await listOrderPayments())[0]).toMatchObject({ receivedMinor: 225_000 });

    await recordPayment({ orderNumber: order.number, amountMinor: 250_000, method: "CASH", receivedAt: new Date() }, null);
    expect((await listOrderPayments())[0]).toMatchObject({ state: "PAID", balanceMinor: 0 });
    await expect(recordPayment({ orderNumber: "MP-NOPE", amountMinor: 100, method: "CASH", receivedAt: new Date() }, null)).rejects.toThrow(/not found/);
  });

  it("helpers", () => {
    expect(paymentState(1000, 0)).toBe("UNPAID");
    expect(paymentState(1000, 500)).toBe("PARTIAL");
    expect(paymentState(1000, 1000)).toBe("PAID");
    expect(amountReceived({ amountPaidMinor: 300 }, 200)).toBe(300);
    expect(karachiDateToUtc("2026-10-30")!.toISOString()).toBe("2026-10-30T07:00:00.000Z");
    expect(karachiDateToUtc("30/10/2026")).toBeNull();
  });
});

describe("customers", () => {
  it("groups orders by phone, searches, and keeps notes", async () => {
    await whatsappOrder("Bilal Ahmed", "0300 7654321", "1000");
    await whatsappOrder("Bilal A.", "+92 300 7654321", "2000");
    await whatsappOrder("Sana Malik", "0321 1112223", "500");

    const all = await listCustomers();
    expect(all).toHaveLength(2);
    expect((await listCustomers("sana")).map((c) => c.name)).toEqual(["Sana Malik"]);
    expect((await listCustomers("0300 765")).map((c) => c.orderCount)).toEqual([2]);

    const bilal = all.find((c) => c.orderCount === 2)!;
    expect(bilal.totalOrderedMinor).toBe(300_000);
    await saveCustomerNote(bilal.key, "Prefers matte finish");
    const detail = await getCustomer(bilal.key);
    expect(detail).toMatchObject({ note: "Prefers matte finish", orderCount: 2 });
    expect(detail!.orders).toHaveLength(2);
    expect(await getCustomer("x:bad key")).toBeNull();
  });
});

describe("reports", () => {
  it("sums sales by Pakistan day and month, ranks products and lists balances", async () => {
    const a = await whatsappOrder("Asad", "0300 1111111", "1000", "Flex banner");
    await whatsappOrder("Bushra", "0300 2222222", "3000", "Sign board");
    const cancelled = await whatsappOrder("Chaudhry", "0300 3333333", "9000", "Sign board");
    await updateOrderStatus(cancelled.id, "CANCELLED", null);
    // 23:30 Pakistan time on 30 Oct is 18:30 UTC, still 30 Oct; 00:30 on 31 Oct is 19:30 UTC on the 30th.
    await prisma.order.update({ where: { id: a.id }, data: { placedAt: new Date("2026-10-30T19:30:00Z") } });

    const now = new Date("2026-10-31T10:00:00Z");
    const days = await salesByDay(3, now);
    expect(days.map((d) => d.period)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31"]);
    expect(days.find((d) => d.period === "2026-10-31")!.salesMinor).toBeGreaterThanOrEqual(100_000);

    const months = await salesByMonth(2, now);
    expect(months.map((m) => m.period)).toEqual(["2026-09", "2026-10"]);

    const products = await topProducts();
    expect(products[0]).toMatchObject({ name: "Sign board", salesMinor: 300_000 });
    expect((await unpaidBalances()).map((o) => o.balanceMinor)).toEqual([300_000, 100_000]);
  });
});
