import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createCommissionForOrder, onOrderStatusChanged } from "@/lib/affiliate/service";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/generated/prisma/client";

// Orders placed on WhatsApp are recorded here by staff. When the customer came through an
// affiliate link, entering the affiliate code creates the commission like an online order would.

const rupeesToPaisa = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter the amount in rupees, e.g. 4500.")
  .transform((v) => Math.round(Number(v) * 100));

export const recordOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name.").max(100),
  customerPhone: z.string().trim().min(7, "Enter the customer's phone or WhatsApp number.").max(30),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null),
  items: z
    .array(
      z.object({
        productId: z
          .string()
          .trim()
          .max(50)
          .transform((v) => v || null),
        description: z.string().trim().min(2, "Describe each item.").max(200),
        quantity: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1_000_000),
        total: rupeesToPaisa,
      }),
    )
    .min(1, "Add at least one item."),
});
export type RecordOrderInput = z.infer<typeof recordOrderSchema>;

export const ORDER_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "IN_DESIGN",
  "AWAITING_PROOF_APPROVAL",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export type RecordOrderResult = { orderId: string; number: string; commission: "created" | "invalid-code" | "none" };

/** Saves a WhatsApp order as CONFIRMED and, with a valid affiliate code, creates a pending commission. */
export async function recordWhatsAppOrder(input: RecordOrderInput, staffUserId: string | null): Promise<RecordOrderResult> {
  const total = input.items.reduce((sum, i) => sum + i.total, 0);
  const number = `MP-${new Date().getFullYear().toString().slice(2)}${randomBytes(3).toString("hex").toUpperCase()}`;
  const productIds = input.items.map((i) => i.productId).filter((id): id is string => !!id);
  const known = new Set((await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id));

  const order = await prisma.order.create({
    data: {
      number,
      source: "WHATSAPP",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerNotes: input.notes,
      status: "CONFIRMED",
      subtotalMinor: total,
      totalMinor: total,
      shippingAddress: { name: input.customerName, phone: input.customerPhone },
      items: {
        create: input.items.map((i) => ({
          productId: i.productId && known.has(i.productId) ? i.productId : null,
          productName: i.description,
          optionsSummary: [],
          quantity: i.quantity,
          unitPriceMinor: Math.round(i.total / i.quantity),
          lineTotalMinor: i.total,
        })),
      },
      statusEvents: { create: { status: "CONFIRMED", note: "Recorded from WhatsApp", createdById: staffUserId } },
    },
  });

  if (!input.referralCode) return { orderId: order.id, number, commission: "none" };
  const commission = await createCommissionForOrder(order.id, input.referralCode);
  return { orderId: order.id, number, commission: commission ? "created" : "invalid-code" };
}

/** Moves an order to a new status; cancelled or refunded orders lose their commission. */
export async function updateOrderStatus(orderId: string, status: OrderStatus, staffUserId: string | null): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status, statusEvents: { create: { status, createdById: staffUserId } } },
  });
  await onOrderStatusChanged(orderId, status);
}

export async function listRecentOrders(take = 100) {
  return prisma.order.findMany({
    orderBy: { placedAt: "desc" },
    take,
    select: {
      id: true,
      number: true,
      source: true,
      status: true,
      customerName: true,
      customerPhone: true,
      totalMinor: true,
      placedAt: true,
      user: { select: { name: true } },
      affiliate: { select: { code: true } },
      commission: { select: { amountMinor: true, status: true } },
      items: { select: { productName: true, quantity: true } },
    },
  });
}
