"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  addCartItem,
  CartError,
  removeCartItem,
  updateCartItemOptions,
  updateCartItemQuantity,
} from "@/lib/cart/service";
import { ensureCartId } from "@/lib/cart/session";
import { addToCartSchema } from "@/lib/validation";

export type CartActionState = { ok?: boolean; error?: string };

export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = addToCartSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    optionValueIds: formData.getAll("optionValueId").map(String).filter(Boolean),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Please check your selections and quantity." };

  try {
    await addCartItem(await ensureCartId(), parsed.data);
  } catch (error) {
    if (error instanceof CartError) return { error: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

const updateSchema = z.object({ itemId: z.string().min(1).max(50), quantity: z.coerce.number().int() });

export async function updateCartItemAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = updateSchema.safeParse({ itemId: formData.get("itemId"), quantity: formData.get("quantity") });
  if (!parsed.success) return { error: "Enter a valid quantity." };
  try {
    await updateCartItemQuantity(await ensureCartId(), parsed.data.itemId, parsed.data.quantity);
  } catch (error) {
    if (error instanceof CartError) return { error: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

const optionsSchema = z.object({
  itemId: z.string().min(1).max(50),
  optionValueIds: z.array(z.string().min(1).max(50)).max(20),
});

export async function updateCartItemOptionsAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const parsed = optionsSchema.safeParse({
    itemId: formData.get("itemId"),
    optionValueIds: formData.getAll("optionValueId").map(String).filter(Boolean),
  });
  if (!parsed.success) return { error: "Please choose your options." };
  try {
    await updateCartItemOptions(await ensureCartId(), parsed.data.itemId, parsed.data.optionValueIds);
  } catch (error) {
    if (error instanceof CartError) return { error: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const itemId = z.string().min(1).max(50).safeParse(formData.get("itemId"));
  if (!itemId.success) return;
  await removeCartItem(await ensureCartId(), itemId.data);
  refresh();
}
