import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { approveCommission, createCommissionForOrder, onOrderStatusChanged } from "@/lib/affiliate/service";
import { readSiteSettings, whatsappUrl } from "@/lib/content/site-settings";
import { prisma } from "@/lib/db";
import { resendTransport, type EmailTransport } from "@/lib/email";
import { formatPKR } from "@/lib/money";
import { absoluteUrl } from "@/lib/seo";
import { saveFile } from "@/lib/storage";
import { descriptiveKey, toWebp } from "@/lib/storage/webp";
import type { OrderStatus } from "@/generated/prisma/client";

// Orders placed on WhatsApp or in the AI chat. Payment terms: 50% advance before work starts,
// the remaining 50% after the work is complete, before delivery. The affiliate's commission is
// approved when the order is fully paid.

/** The order flow, in order, followed by the statuses that end an order early. */
export const ORDER_FLOW = ["PENDING_PAYMENT", "ADVANCE_RECEIVED", "IN_PROGRESS", "WORK_COMPLETED", "FULLY_PAID", "DELIVERED"] as const;
export const ORDER_STATUSES: OrderStatus[] = [...ORDER_FLOW, "CANCELLED", "REFUNDED"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending",
  PAYMENT_REVIEW: "Payment review",
  CONFIRMED: "Confirmed",
  ADVANCE_RECEIVED: "Advance Received",
  IN_PROGRESS: "In Progress",
  IN_DESIGN: "In design",
  AWAITING_PROOF_APPROVAL: "Awaiting proof approval",
  IN_PRODUCTION: "In production",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  WORK_COMPLETED: "Work Completed",
  FULLY_PAID: "Fully Paid",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAYMENT_TERMS = "50% advance before work starts, and the remaining 50% after the work is complete, before delivery.";

/** Half of the total, rounded up to the rupee. */
export const advanceDue = (totalMinor: number) => Math.ceil(totalMinor / 200) * 100;
export const balanceDue = (order: { totalMinor: number; amountPaidMinor: number }) => Math.max(order.totalMinor - order.amountPaidMinor, 0);

const rupeesToPaisa = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter the amount in rupees, e.g. 4500.")
  .transform((v) => Math.round(Number(v) * 100));

export const recordOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name.").max(100),
  customerPhone: z.string().trim().min(7, "Enter the customer's phone or WhatsApp number.").max(30),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address, or leave it empty."),
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

export type RecordOrderResult = { orderId: string; number: string; commission: "created" | "invalid-code" | "none" };

/** Saves an order as "Pending" and, with a valid affiliate code, creates a pending commission. */
export async function recordOrder(
  input: RecordOrderInput,
  staffUserId: string | null,
  source: "WHATSAPP" | "CHAT" = "WHATSAPP",
): Promise<RecordOrderResult> {
  const total = input.items.reduce((sum, i) => sum + i.total, 0);
  const number = `MP-${new Date().getFullYear().toString().slice(2)}${randomBytes(3).toString("hex").toUpperCase()}`;
  const productIds = input.items.map((i) => i.productId).filter((id): id is string => !!id);
  const known = new Set((await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id));

  const order = await prisma.order.create({
    data: {
      number,
      source,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerNotes: input.notes,
      status: "PENDING_PAYMENT",
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
      statusEvents: {
        create: { status: "PENDING_PAYMENT", note: source === "CHAT" ? "Placed in the AI chat" : "Recorded from WhatsApp", createdById: staffUserId },
      },
    },
  });

  if (!input.referralCode) return { orderId: order.id, number, commission: "none" };
  const commission = await createCommissionForOrder(order.id, input.referralCode);
  return { orderId: order.id, number, commission: commission ? "created" : "invalid-code" };
}

/** Kept for existing callers: a WhatsApp order recorded by staff. */
export const recordWhatsAppOrder = (input: RecordOrderInput, staffUserId: string | null) => recordOrder(input, staffUserId, "WHATSAPP");

export type StatusUpdateResult = { emailed: boolean | null; whatsappLink: string | null };

/**
 * Moves an order to a new status:
 * - Advance Received records the advance (default: half the total).
 * - Work Completed emails the customer the work photos and the balance request, and returns a ready-made
 *   WhatsApp message link for staff to send.
 * - Fully Paid records full payment and approves the affiliate's commission.
 * - Cancelled or Refunded reverses the commission.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  staffUserId: string | null,
  options: { amountReceivedMinor?: number | null } = {},
  transport: EmailTransport = resendTransport,
): Promise<StatusUpdateResult> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { totalMinor: true, amountPaidMinor: true } });
  let amountPaidMinor = order.amountPaidMinor;
  if (status === "ADVANCE_RECEIVED") amountPaidMinor = Math.max(amountPaidMinor, options.amountReceivedMinor ?? advanceDue(order.totalMinor));
  if (status === "FULLY_PAID" || status === "DELIVERED") amountPaidMinor = Math.max(amountPaidMinor, order.totalMinor);
  amountPaidMinor = Math.min(amountPaidMinor, order.totalMinor);

  await prisma.order.update({
    where: { id: orderId },
    data: { status, amountPaidMinor, statusEvents: { create: { status, createdById: staffUserId } } },
  });

  if (status === "FULLY_PAID") {
    const commission = await prisma.affiliateCommission.findUnique({ where: { orderId }, select: { id: true, status: true } });
    if (commission?.status === "PENDING") await approveCommission(commission.id);
  }
  await onOrderStatusChanged(orderId, status);

  if (status === "WORK_COMPLETED") return notifyWorkCompleted(orderId, transport);
  return { emailed: null, whatsappLink: null };
}

/** The message sent when the work is finished: photos and the remaining payment. */
export async function workCompletedMessage(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      number: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      totalMinor: true,
      amountPaidMinor: true,
      workPhotos: { orderBy: { createdAt: "asc" }, select: { url: true } },
      user: { select: { email: true, name: true, phone: true } },
    },
  });
  const name = order.customerName ?? order.user?.name ?? "Customer";
  const photos = order.workPhotos.map((p) => absoluteUrl(p.url));
  const text = [
    `Assalam o Alaikum ${name},`,
    "",
    `Your Mix Print Design order ${order.number} is complete.`,
    ...(photos.length ? ["", "Pictures of your finished work:", ...photos] : []),
    "",
    `Total: ${formatPKR(order.totalMinor)}`,
    `Paid: ${formatPKR(order.amountPaidMinor)}`,
    `Remaining balance: ${formatPKR(balanceDue(order))}`,
    "",
    "Please send the remaining payment so we can deliver your order. Track your order at " + absoluteUrl(`/track?order=${order.number}`),
    "",
    "Thank you, Mix Print Design",
  ].join("\n");
  return { order, text, email: order.customerEmail ?? order.user?.email ?? null, phone: order.customerPhone ?? order.user?.phone ?? null };
}

async function notifyWorkCompleted(orderId: string, transport: EmailTransport): Promise<StatusUpdateResult> {
  const { order, text, email, phone } = await workCompletedMessage(orderId);
  let emailed: boolean | null = null;
  if (email) {
    const result = await transport({ to: email, subject: `Your order ${order.number} is ready – remaining payment`, text });
    emailed = result.sent;
  }
  const digits = phone?.replace(/\D/g, "").replace(/^0/, "92") ?? null;
  const settings = await readSiteSettings();
  return { emailed, whatsappLink: digits ? whatsappUrl({ ...settings, whatsappNumber: digits }, text) : null };
}

/** Adds a picture of the finished work (WebP, descriptive file name). */
export async function addOrderPhoto(orderId: string, bytes: Uint8Array) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { number: true } });
  const image = await toWebp(bytes, 1600);
  if (!image.ok) throw new Error(image.error);
  const stored = await saveFile(descriptiveKey(`orders/${orderId}`, `${order.number} finished work mix print design`, image.ext), image.bytes, image.type);
  return prisma.orderPhoto.create({ data: { orderId, url: stored.url, storageKey: stored.key } });
}

/** Order status for customers: the order number plus the phone number used for the order. */
export async function findOrderForTracking(number: string, phone: string) {
  const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);
  const order = await prisma.order.findUnique({
    where: { number: number.trim().toUpperCase() },
    select: {
      number: true,
      status: true,
      totalMinor: true,
      amountPaidMinor: true,
      placedAt: true,
      customerPhone: true,
      user: { select: { phone: true } },
      items: { select: { productName: true, quantity: true } },
      workPhotos: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
      statusEvents: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
    },
  });
  const wanted = digits(phone);
  if (!order || wanted.length < 7 || ![order.customerPhone, order.user?.phone].some((p) => digits(p) === wanted)) return null;
  const { customerPhone: _p, user: _u, ...visible } = order;
  return visible;
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
      customerEmail: true,
      totalMinor: true,
      amountPaidMinor: true,
      placedAt: true,
      user: { select: { name: true } },
      affiliate: { select: { code: true } },
      commission: { select: { amountMinor: true, status: true } },
      items: { select: { productName: true, quantity: true } },
      workPhotos: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
    },
  });
}
