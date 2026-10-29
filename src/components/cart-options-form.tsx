"use client";

import { useActionState } from "react";
import { updateCartItemOptionsAction, type CartActionState } from "@/app/actions/cart";
import { formatPKR } from "@/lib/money";
import type { OptionInput, SelectedOption } from "@/lib/pricing";

type Props = { itemId: string; options: OptionInput[]; selection: SelectedOption[] };

export function CartOptionsForm({ itemId, options, selection }: Props) {
  const [state, formAction, pending] = useActionState<CartActionState, FormData>(updateCartItemOptionsAction, {});
  if (options.length === 0) return null;
  const selected = new Map(selection.map((s) => [s.optionId, s.valueId]));

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-brand">Change options</summary>
      <form action={formAction} className="mt-2 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="itemId" value={itemId} />
        {options.map((option) => (
          <div key={option.id}>
            <label htmlFor={`${itemId}-${option.id}`} className="label">
              {option.name}
            </label>
            <select
              id={`${itemId}-${option.id}`}
              name="optionValueId"
              defaultValue={selected.get(option.id) ?? option.values[0]?.id}
              className="input py-1.5"
            >
              {option.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.priceDeltaMinor > 0
                    ? ` (+${formatPKR(v.priceDeltaMinor)}${v.pricing === "PER_ORDER" ? " once" : "/unit"})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="sm:col-span-2">
          <button className="btn-secondary py-1.5" disabled={pending}>
            {pending ? "Saving…" : "Save options"}
          </button>
          {state.error && (
            <span className="field-error ml-2" role="alert">
              {state.error}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
