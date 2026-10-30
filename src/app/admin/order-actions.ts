"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { addOrderPhoto, ORDER_STATUSES, recordOrder, recordOrderSchema, updateOrderStatus } from "@/lib/orders/manual";
import { parseRupees } from "@/lib/admin/product-input";
import type { ActionState } from "./affiliate-actions";

const ROWS = 5;
const orderId = z.string().min(1).max(50);

export async function recordOrderAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const field = (k: string) => String(data.get(k) ?? "");
  const items = Array.from({ length: ROWS }, (_, i) => ({
    productId: field(`item${i}.productId`),
    description: field(`item${i}.description`),
    quantity: field(`item${i}.quantity`),
    total: field(`item${i}.total`),
  })).filter((item) => item.description.trim() || item.total.trim());
  const parsed = recordOrderSchema.safeParse({
    customerName: field("customerName"),
    customerPhone: field("customerPhone"),
    customerEmail: field("customerEmail"),
    referralCode: field("referralCode"),
    notes: field("notes"),
    items,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const result = await recordOrder(parsed.data, staff.id, "WHATSAPP");
  refresh();
  const commission = {
    created: " Affiliate commission added (approved automatically when the order is Fully Paid).",
    "invalid-code": " The affiliate code was not found or not active, so no commission was added.",
    none: "",
  }[result.commission];
  return { message: `Order ${result.number} recorded as Pending.${commission}` };
}

export async function updateOrderStatusAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const id = orderId.parse(data.get("orderId"));
  const status = z.enum(ORDER_STATUSES as [string, ...string[]]).parse(data.get("status")) as (typeof ORDER_STATUSES)[number];
  const amountText = String(data.get("amountReceived") ?? "").trim();
  const amount = amountText ? parseRupees(amountText) : null;
  if (amountText && amount === null) return { error: "Amount received: enter rupees, e.g. 2500." };
  const result = await updateOrderStatus(id, status, staff.id, { amountReceivedMinor: amount });
  refresh();
  if (status === "WORK_COMPLETED") {
    const email = result.emailed === null ? "No customer email on this order." : result.emailed ? "Email sent to the customer." : "The email could not be sent (check Resend).";
    return { message: `Status updated. ${email} Use "Send on WhatsApp" to message the customer.` };
  }
  return { message: "Status updated." };
}

export async function uploadOrderPhotoAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff();
  const id = orderId.parse(data.get("orderId"));
  const files = data.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one photo." };
  for (const file of files) {
    try {
      await addOrderPhoto(id, new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      return { error: `${file.name}: ${(error as Error).message}` };
    }
  }
  refresh();
  return { message: `${files.length} photo${files.length > 1 ? "s" : ""} added.` };
}
