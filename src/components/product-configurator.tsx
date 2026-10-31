"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeWebsiteOrderAction } from "@/app/order/actions";
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

/**
 * Options, quantity and live price. "Order now" asks for name, mobile and city/address, saves the order on
 * the website (with the affiliate from the referral cookie), then opens WhatsApp with the order number.
 */
export function ProductConfigurator({ product }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.id, o.values[0]?.id ?? ""])),
  );
  const [quantity, setQuantity] = useState(product.minQuantity);
  const [notes, setNotes] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [details, setDetails] = useState({ name: "", phone: "", city: "" });
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const router = useRouter();

  // Same pricing code as the server; the server recalculates and is the source of truth.
  const quote = useMemo((): { error: string } | (LinePrice & { error: null }) => {
    const resolved = resolveSelection(product.options, Object.values(selected));
    if (!resolved.ok) return { error: resolved.error };
    const quantityError = validateQuantity(product, quantity);
    if (quantityError) return { error: quantityError };
    return { ...linePrice(product, resolved.selection, quantity), error: null };
  }, [product, selected, quantity]);

  function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOrderError(null);
    // Opened now, while the click still counts as the customer's action, so pop-up blockers allow it.
    const whatsappTab = window.open("about:blank", "_blank");
    startPlacing(async () => {
      try {
        const result = await placeWebsiteOrderAction({
          productId: product.id,
          optionValueIds: Object.values(selected).filter(Boolean),
          quantity,
          ...details,
          note: notes,
        });
        if (!result.ok) {
          whatsappTab?.close();
          setOrderError(result.error);
          return;
        }
        if (whatsappTab) {
          whatsappTab.opener = null;
          whatsappTab.location.href = result.whatsappUrl;
        }
        router.push(result.confirmationPath);
      } catch {
        whatsappTab?.close();
        setOrderError("Your order could not be sent. Please check your connection and try again.");
      }
    });
  }

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
          Note for our team <span className="font-normal text-muted">(optional)</span>
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
        {!checkout && (
          <button
            type="button"
            className="btn-primary"
            disabled={quote.error !== null}
            onClick={() => setCheckout(true)}
            data-testid="order-now"
          >
            Order now
          </button>
        )}
      </div>

      {checkout && (
        <form onSubmit={placeOrder} className="space-y-3 rounded-lg border border-border bg-surface p-4" aria-label="Your details" noValidate>
          <p className="text-sm font-semibold">Your details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Your name</span>
              <input
                className="input"
                autoComplete="name"
                required
                maxLength={100}
                value={details.name}
                onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="label">Mobile / WhatsApp number</span>
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                placeholder="0300 1234567"
                required
                maxLength={30}
                value={details.phone}
                onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
              />
            </label>
          </div>
          <label className="block">
            <span className="label">City and address</span>
            <input
              className="input"
              autoComplete="street-address"
              placeholder="e.g. Raiwind Road, Lahore"
              required
              maxLength={300}
              value={details.city}
              onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))}
            />
          </label>
          {orderError && (
            <p className="field-error" role="alert">
              {orderError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={placing || quote.error !== null} data-testid="place-order">
              {placing ? "Saving your order…" : "Place order & open WhatsApp"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setCheckout(false)} disabled={placing}>
              Back
            </button>
          </div>
        </form>
      )}
      <p className="text-xs text-muted">
        Your order is saved with an order number, then WhatsApp opens so we can confirm the artwork and delivery with you.
      </p>
    </div>
  );
}
