"use client";

import { useMemo, useState } from "react";
import { whatsappLink } from "@/lib/business";
import { formatPKR } from "@/lib/money";
import {
  formatPercent,
  linePrice,
  resolveSelection,
  validateQuantity,
  type LinePrice,
  type ProductPricingInput,
} from "@/lib/pricing";

type Props = { product: ProductPricingInput & { id: string }; productName: string; productUrl: string };

/** Options, quantity and live price; the order is sent to us on WhatsApp with everything filled in. */
export function ProductConfigurator({ product, productName, productUrl }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.id, o.values[0]?.id ?? ""])),
  );
  const [quantity, setQuantity] = useState(product.minQuantity);
  const [notes, setNotes] = useState("");

  // Same pricing code as the server; the server recalculates and is the source of truth.
  const quote = useMemo((): { error: string } | (LinePrice & { error: null }) => {
    const resolved = resolveSelection(product.options, Object.values(selected));
    if (!resolved.ok) return { error: resolved.error };
    const quantityError = validateQuantity(product, quantity);
    if (quantityError) return { error: quantityError };
    return { ...linePrice(product, resolved.selection, quantity), error: null };
  }, [product, selected, quantity]);

  const orderMessage = [
    "Assalam o Alaikum! I'd like to order:",
    `*${productName}*`,
    ...product.options.map((o) => `${o.name}: ${o.values.find((v) => v.id === selected[o.id])?.label ?? "-"}`),
    `Quantity: ${quantity}`,
    ...(quote.error === null ? [`Price shown: ${formatPKR(quote.lineTotalMinor)}`] : []),
    ...(notes.trim() ? [`Notes: ${notes.trim()}`] : []),
    productUrl,
  ].join("\n");

  return (
    <div className="card mt-6 space-y-5 p-5">
      {product.options.map((option) => (
        <fieldset key={option.id}>
          <legend className="label">{option.name}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const checked = selected[option.id] === value.id;
              return (
                <label
                  key={value.id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                    checked ? "border-brand bg-brand/10 font-semibold" : "border-border hover:border-foreground/40"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`option-${option.id}`}
                    value={value.id}
                    checked={checked}
                    onChange={() => setSelected((s) => ({ ...s, [option.id]: value.id }))}
                  />
                  {value.label}
                  {value.priceDeltaMinor > 0 && (
                    <span className="ml-1 text-xs text-muted">
                      +{formatPKR(value.priceDeltaMinor)}
                      {value.pricing === "PER_ORDER" ? " once" : "/unit"}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <label htmlFor="quantity" className="label">
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={product.minQuantity}
          step={product.quantityStep}
          value={Number.isNaN(quantity) ? "" : quantity}
          onChange={(e) => setQuantity(e.target.valueAsNumber)}
          className="input max-w-40"
        />
        <p className="mt-1 text-xs text-muted">
          Minimum {product.minQuantity}
          {product.quantityStep > 1 ? `, in steps of ${product.quantityStep}` : ""}.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="label">
          Notes for our team <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="notes" name="notes" rows={2} maxLength={500} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-end justify-between border-t border-border pt-4">
        {quote.error !== null ? (
          <p className="field-error" role="alert">
            {quote.error}
          </p>
        ) : (
          <div>
            <p className="text-sm text-muted">{formatPKR(quote.unitPriceMinor)} per unit</p>
            {quote.discountMinor > 0 && (
              <p className="text-sm text-green-700 dark:text-green-400">
                Bulk discount {formatPercent(quote.discountBps)}: −{formatPKR(quote.discountMinor)}
              </p>
            )}
            {quote.flatFeesMinor > 0 && (
              <p className="text-sm text-muted">Includes {formatPKR(quote.flatFeesMinor)} one-time setup</p>
            )}
            <p className="text-2xl font-bold" data-testid="live-total">
              {formatPKR(quote.lineTotalMinor)}
            </p>
          </div>
        )}
        {quote.error === null ? (
          <a href={whatsappLink(orderMessage)} target="_blank" rel="noopener noreferrer" className="btn-primary" data-testid="order-whatsapp">
            Order on WhatsApp
          </a>
        ) : (
          <span className="btn-primary pointer-events-none opacity-50" aria-disabled>
            Order on WhatsApp
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        WhatsApp opens with your order details. We confirm the price, artwork and delivery with you there.
      </p>
    </div>
  );
}
