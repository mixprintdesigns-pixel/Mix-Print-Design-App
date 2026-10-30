"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { parseRupees } from "@/lib/admin/product-input";
import { addDesignProof, addOrderToDesignWork, DESIGN_STATUSES, DesignWorkError, setDesignBrief, setDesignStatus } from "@/lib/admin-sections/design-work";
import { saveCustomerNote } from "@/lib/admin-sections/customers";
import { PAYMENT_METHODS, PaymentError, recordPayment } from "@/lib/admin-sections/payments";
import { karachiDateToUtc } from "@/lib/admin-sections/shared";
import type { ActionState } from "./affiliate-actions";

// Actions for the Design work, Customers and Payments admin sections.

const id = z.string().min(1).max(50);
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

async function handle(fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    refresh();
    return { message };
  } catch (error) {
    if (error instanceof DesignWorkError || error instanceof PaymentError) return { error: error.message };
    throw error;
  }
}

export async function addDesignJobAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff();
  const number = text(data, "orderNumber").trim();
  if (!number) return { error: "Enter the order number, e.g. MP-260001." };
  return handle(async () => {
    const { created } = await addOrderToDesignWork(number, text(data, "brief").slice(0, 2000));
    return created ? `Order ${number.toUpperCase()} added to design work.` : `Order ${number.toUpperCase()} is already on the design list.`;
  });
}

export async function updateDesignJobAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff();
  const jobId = id.parse(data.get("jobId"));
  const status = z.enum(DESIGN_STATUSES).parse(data.get("status"));
  return handle(async () => {
    await setDesignStatus(jobId, status);
    if (data.has("brief")) await setDesignBrief(jobId, text(data, "brief").slice(0, 2000));
    return "Saved.";
  });
}

export async function uploadDesignProofAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff();
  const jobId = id.parse(data.get("jobId"));
  const file = data.get("proof");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a proof file (JPG, PNG, WebP or PDF)." };
  return handle(async () => {
    const proof = await addDesignProof(jobId, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name }, text(data, "staffNote").slice(0, 1000));
    return `Proof version ${proof.version} uploaded. Share the approval link with the customer.`;
  });
}

export async function saveCustomerNoteAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff();
  const key = z.string().min(3).max(320).parse(data.get("customerKey"));
  await saveCustomerNote(key, text(data, "note"));
  refresh();
  return { message: "Notes saved." };
}

export async function recordPaymentAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const amount = parseRupees(text(data, "amount"));
  if (!amount) return { error: "Amount: enter rupees, e.g. 2500." };
  const method = z.enum(PAYMENT_METHODS).safeParse(data.get("method"));
  if (!method.success) return { error: "Choose how the payment was received." };
  const receivedAt = karachiDateToUtc(text(data, "receivedOn"));
  if (!receivedAt) return { error: "Choose the date the payment was received." };
  return handle(async () => {
    const result = await recordPayment(
      { orderNumber: text(data, "orderNumber"), amountMinor: amount, method: method.data, receivedAt, reference: text(data, "reference"), note: text(data, "note") },
      staff.id,
    );
    return `Payment recorded for ${result.orderNumber}.`;
  });
}
