"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeRateOrderAction } from "@/app/order/actions";
import { formatRs, quoteRate, SIZE_UNITS, UNIT_LABELS, type SizeUnit } from "@/lib/rates/calculator";
import { VARIANT_LABEL, type PublicRateItem } from "@/lib/rates/visibility";

type Props = {
  item: Pick<PublicRateItem, "id" | "name" | "variantType" | "rateMinor" | "variants">;
  designChargeMinor: number;
  minOrderMinor: number | null;
};

type SideText = { value: string; inches: string };
const empty: SideText = { value: "", inches: "" };
const toNumber = (s: string) => (s.trim() === "" ? 0 : Number(s));

/**
 * The size calculator, the same on every rate page: GSM / series choice (if any), width × height in the chosen
 * unit, quantity, and a live price breakdown. "Order now" asks for name, mobile and address, saves the order
 * on the website (with the affiliate from the referral cookie), then opens WhatsApp with the order number.
 */
export function RateCalculator({ item, designChargeMinor, minOrderMinor }: Props) {
  const uid = useId();
  const [variantId, setVariantId] = useState(item.variants[0]?.id ?? "");
  const [unit, setUnit] = useState<SizeUnit>("ft-in");
  const [width, setWidth] = useState<SideText>(empty);
  const [height, setHeight] = useState<SideText>(empty);
  const [quantity, setQuantity] = useState("1");
  const [checkout, setCheckout] = useState(false);
  const [details, setDetails] = useState({ name: "", phone: "", city: "", note: "" });
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const router = useRouter();

  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const rateMinor = item.variantType === "NONE" ? item.rateMinor : (variant?.rateMinor ?? 0);
  const typed = width.value + width.inches + height.value + height.inches !== "";

  const size = {
    unit,
    width: { value: toNumber(width.value), inches: unit === "ft-in" ? toNumber(width.inches) : undefined },
    height: { value: toNumber(height.value), inches: unit === "ft-in" ? toNumber(height.inches) : undefined },
    quantity: Number(quantity),
  };
  // Same calculation as the server, which recalculates the order from the database rates.
  const result = quoteRate(size, { rateMinor, designChargeMinor, minOrderMinor });
  const quote = result.ok ? result.quote : null;

  function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setOrderError(null);
    // Opened now, while the click still counts as the customer's action, so pop-up blockers allow it.
    const whatsappTab = window.open("about:blank", "_blank");
    startPlacing(async () => {
      try {
        const res = await placeRateOrderAction({ itemId: item.id, variantId, ...size, ...details });
        if (!res.ok) {
          whatsappTab?.close();
          setOrderError(res.error);
          return;
        }
        if (whatsappTab) {
          whatsappTab.opener = null;
          whatsappTab.location.href = res.whatsappUrl;
        }
        router.push(res.confirmationPath);
      } catch {
        whatsappTab?.close();
        setOrderError("Your order could not be sent. Please check your connection and try again.");
      }
    });
  }

  const sideInputs = (label: "Width" | "Height", value: SideText, set: (v: SideText) => void) => (
    <fieldset className="min-w-0">
      <legend className="label">{label}</legend>
      {unit === "ft-in" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="relative block">
            <input
              inputMode="decimal"
              className="input pr-9"
              value={value.value}
              onChange={(e) => set({ ...value, value: e.target.value })}
              placeholder="0"
              aria-label={`${label} (ft)`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">ft</span>
          </label>
          <label className="relative block">
            <input
              inputMode="decimal"
              className="input pr-9"
              value={value.inches}
              onChange={(e) => set({ ...value, inches: e.target.value })}
              placeholder="0"
              aria-label={`${label} (in)`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">in</span>
          </label>
        </div>
      ) : (
        <label className="relative block">
          <input
            inputMode="decimal"
            className="input pr-14"
            value={value.value}
            onChange={(e) => set({ ...value, value: e.target.value })}
            placeholder="0"
            aria-label={`${label} (${unit})`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
        </label>
      )}
    </fieldset>
  );

  return (
    <div className="mt-5 rounded-xl border border-border bg-background/60 p-4 sm:p-5" data-testid="rate-calculator">
      {item.variantType !== "NONE" && item.variants.length > 0 && (
        <fieldset className="mb-4">
          <legend className="label">Choose {VARIANT_LABEL[item.variantType]}</legend>
          <div className="flex flex-wrap gap-2">
            {item.variants.map((v) => {
              const checked = v.id === variantId;
              return (
                <label
                  key={v.id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition app:min-h-12 app:px-4 app:py-3 app:text-base ${
                    checked ? "border-brand bg-brand/10 font-semibold" : "border-border bg-surface hover:border-foreground/40"
                  }`}
                >
                  <input type="radio" name={`${uid}-variant`} className="sr-only" checked={checked} onChange={() => setVariantId(v.id)} />
                  {v.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className="text-lg font-bold" data-testid="rate-per-sqft">
        <span className="text-brand">{formatRs(rateMinor)}</span> <span className="text-base font-medium text-muted">per sq ft</span>
        {variant && <span className="ml-1 text-sm font-medium text-muted">({variant.label})</span>}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr]">
        <label className="block sm:col-span-2">
          <span className="label">Unit</span>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as SizeUnit)} aria-label="Unit">
            {SIZE_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
        {sideInputs("Width", width, setWidth)}
        {sideInputs("Height", height, setHeight)}
        <label className="block">
          <span className="label">Quantity (pieces)</span>
          <input type="number" min={1} step={1} inputMode="numeric" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
      </div>

      <p className="mt-3 text-sm text-muted">Each side is charged to the next full foot.</p>

      {typed && !quote && !result.ok && (
        <p className="field-error mt-3" role="alert">
          {result.error}
        </p>
      )}

      {quote && (
        <dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface text-sm" data-testid="rate-breakdown" aria-live="polite">
          <Row label="Size entered" value={`${quote.sizeText}${quote.quantity > 1 ? ` × ${quote.quantity} pieces` : ""}`} testId="rate-size" />
          <Row
            label="Billable area"
            value={`${quote.widthFt} ft × ${quote.heightFt} ft${quote.quantity > 1 ? ` × ${quote.quantity}` : ""} = ${quote.sqft} sq ft`}
            testId="rate-area"
          />
          <Row label="Rate per sq ft" value={formatRs(quote.rateMinor)} />
          <Row label={quote.minimumApplied ? "Printing cost (minimum order)" : "Printing cost"} value={formatRs(quote.printingMinor)} testId="rate-printing" />
          <Row label="Design charges (fixed)" value={formatRs(quote.designChargeMinor)} testId="rate-design" />
          <div className="flex items-center justify-between gap-3 px-3 py-3 text-base font-bold">
            <dt>Total</dt>
            <dd data-testid="rate-total">{formatRs(quote.totalMinor)}</dd>
          </div>
        </dl>
      )}

      {!checkout ? (
        <button type="button" className="btn-primary mt-4 w-full py-3 text-base" disabled={!quote} onClick={() => setCheckout(true)} data-testid="rate-order-now">
          Order now
        </button>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={placeOrder} aria-label={`Your details for ${item.name}`}>
          <p className="font-semibold">Your details</p>
          <label className="block">
            <span className="label">Your name</span>
            <input className="input" required autoComplete="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Mobile number</span>
            <input className="input" required type="tel" autoComplete="tel" placeholder="0300 1234567" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">City and address</span>
            <input className="input" required autoComplete="street-address" value={details.city} onChange={(e) => setDetails({ ...details, city: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Note (optional)</span>
            <input className="input" maxLength={500} value={details.note} onChange={(e) => setDetails({ ...details, note: e.target.value })} />
          </label>
          {orderError && (
            <p className="field-error" role="alert">
              {orderError}
            </p>
          )}
          <button className="btn w-full bg-green-600 py-3 text-base text-white hover:bg-green-700" disabled={placing || !quote}>
            {placing ? "Saving your order…" : "Confirm & continue on WhatsApp"}
          </button>
          <p className="text-xs text-muted">Your order is saved first, then WhatsApp opens with your order number and details.</p>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
