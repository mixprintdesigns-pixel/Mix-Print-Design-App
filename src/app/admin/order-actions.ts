"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { ORDER_STATUSES, recordOrderSchema, recordWhatsAppOrder, updateOrderStatus } from "@/lib/orders/manual";
import type { ActionState } from "./affiliate-actions";

const ROWS = 5;

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
    referralCode: field("referralCode"),
    notes: field("notes"),
    items,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const result = await recordWhatsAppOrder(parsed.data, staff.id);
  refresh();
  const commission = {
    created: " Affiliate commission added (pending until the order is delivered).",
    "invalid-code": " The affiliate code was not found or not active, so no commission was added.",
    none: "",
  }[result.commission];
  return { message: `Order ${result.number} recorded.${commission}` };
}

export async function updateOrderStatusAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const orderId = z.string().min(1).max(50).parse(data.get("orderId"));
  const status = z.enum(ORDER_STATUSES as [string, ...string[]]).parse(data.get("status")) as (typeof ORDER_STATUSES)[number];
  await updateOrderStatus(orderId, status, staff.id);
  refresh();
  return { message: "Status updated." };
}
