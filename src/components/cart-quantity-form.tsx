"use client";

import { useActionState } from "react";
import { updateCartItemAction, type CartActionState } from "@/app/actions/cart";

type Props = { itemId: string; quantity: number; min: number; step: number };

export function CartQuantityForm({ itemId, quantity, min, step }: Props) {
  const [state, formAction, pending] = useActionState<CartActionState, FormData>(updateCartItemAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <label className="text-sm text-muted" htmlFor={`qty-${itemId}`}>
        Qty
      </label>
      <input
        id={`qty-${itemId}`}
        name="quantity"
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        defaultValue={quantity}
        key={quantity}
        className="input w-28 py-1.5"
      />
      <button className="btn-secondary py-1.5" disabled={pending}>
        {pending ? "Updating…" : "Update"}
      </button>
      {state.error && (
        <span className="field-error w-full" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
