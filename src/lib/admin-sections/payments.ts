import "server-only";
import { prisma } from "@/lib/db";
import type { ManualPaymentMethod } from "@/generated/prisma/client";
import { NOT_SALES_STATUSES } from "./shared";

// Payments: money received against orders (Cash, Bank transfer, JazzCash, Easypaisa),
// each order's payment status, and affiliate commission payouts.

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "JAZZCASH", "EASYPAISA"] as const satisfies readonly ManualPaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
};

export type PaymentState = "PAID" | "PARTIAL" | "UNPAID";
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = { PAID: "Paid", PARTIAL: "Partial", UNPAID: "Unpaid" };

export class PaymentError extends Error {}

/**
 * Amount received for an order. The Orders screen keeps its own "amount received", so the larger
 * of that and the payments recorded here is used; a payment entered in both places is not counted twice.
 */
export function amountReceived(order: { amountPaidMinor: number }, recordedMinor: number): number {
  return Math.max(order.amountPaidMinor, recordedMinor);
}

export function paymentState(totalMinor: number, receivedMinor: number): PaymentState {
  if (receivedMinor <= 0) return "UNPAID";
  return receivedMinor >= totalMinor ? "PAID" : "PARTIAL";
}

export type RecordPaymentInput = {
  orderNumber: string;
  amountMinor: number;
  method: ManualPaymentMethod;
  receivedAt: Date;
  reference?: string | null;
  note?: string | null;
};

export async function recordPayment(input: RecordPaymentInput, staffId: string | null) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new PaymentError("Enter the amount received, e.g. 2500.");
  const order = await prisma.order.findUnique({ where: { number: input.orderNumber.trim().toUpperCase() }, select: { id: true, number: true } });
  if (!order) throw new PaymentError(`Order ${input.orderNumber.trim().toUpperCase()} was not found.`);
  const payment = await prisma.orderPaymentRecord.create({
    data: {
      orderId: order.id,
      amountMinor: input.amountMinor,
      method: input.method,
      receivedAt: input.receivedAt,
      reference: input.reference?.trim().slice(0, 100) || null,
      note: input.note?.trim().slice(0, 500) || null,
      recordedById: staffId,
    },
  });
  return { payment, orderNumber: order.number };
}

/** Sum of recorded payments per order id. */
export async function recordedTotals(orderIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.orderPaymentRecord.groupBy({
    by: ["orderId"],
    where: orderIds ? { orderId: { in: orderIds } } : {},
    _sum: { amountMinor: true },
  });
  return new Map(rows.map((r) => [r.orderId, r._sum.amountMinor ?? 0]));
}

/** Orders (not cancelled or refunded) with total, received, balance and Paid / Partial / Unpaid. */
export async function listOrderPayments(filter?: PaymentState, take = 300) {
  const orders = await prisma.order.findMany({
    where: { status: { notIn: [...NOT_SALES_STATUSES] } },
    orderBy: { placedAt: "desc" },
    take,
    select: {
      id: true,
      number: true,
      status: true,
      placedAt: true,
      totalMinor: true,
      amountPaidMinor: true,
      customerName: true,
      customerPhone: true,
      user: { select: { name: true } },
    },
  });
  const recorded = await recordedTotals(orders.map((o) => o.id));
  const rows = orders.map((o) => {
    const received = amountReceived(o, recorded.get(o.id) ?? 0);
    return {
      ...o,
      customer: o.customerName ?? o.user?.name ?? "—",
      recordedMinor: recorded.get(o.id) ?? 0,
      receivedMinor: received,
      balanceMinor: Math.max(0, o.totalMinor - received),
      state: paymentState(o.totalMinor, received),
    };
  });
  return filter ? rows.filter((r) => r.state === filter) : rows;
}

export async function listRecentPayments(take = 50) {
  const payments = await prisma.orderPaymentRecord.findMany({ orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }], take });
  const orders = await prisma.order.findMany({ where: { id: { in: payments.map((p) => p.orderId) } }, select: { id: true, number: true } });
  return payments.map((p) => ({ ...p, orderNumber: orders.find((o) => o.id === p.orderId)?.number ?? "—" }));
}

/** Affiliate commissions as Paid / Unpaid (reversed commissions are left out). */
export async function listCommissionPayouts(filter?: "PAID" | "UNPAID", take = 300) {
  const commissions = await prisma.affiliateCommission.findMany({
    where: {
      status: filter === "PAID" ? "PAID" : filter === "UNPAID" ? { in: ["PENDING", "APPROVED"] } : { not: "REVERSED" },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amountMinor: true,
      status: true,
      createdAt: true,
      paidAt: true,
      order: { select: { number: true } },
      affiliate: { select: { code: true, user: { select: { name: true } } } },
      withdrawal: { select: { transactionRef: true, processedAt: true } },
    },
  });
  return commissions.map((c) => ({ ...c, paid: c.status === "PAID" }));
}
