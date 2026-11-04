"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { placeRateOrderAction } from "@/app/order/actions";
import { formatRateTag, formatRs, quoteRate, SIZE_UNITS, UNIT_LABELS, type PricingRule, type RateQuote, type SizeUnit } from "@/lib/rates/calculator";
import type { PublicButton } from "@/lib/rates/visibility";

// The rate buttons and the calculator row, the same in every rate section. Clicking a rate button fills the
// Rate field (the customer cannot type a rate); Designing Charges are fixed; CHECK shows the total and a breakdown;
// Order now saves the order (with the affiliate from the referral cookie) and opens WhatsApp.

/** The selected rate: which group (item) and button (variant; for sign boards the item itself). */
export type Selection = { itemId: string; variantId: string | null; button: PublicButton; name: string } | null;

export function RateButton({ button, selected, onSelect, wide = false }: { button: PublicButton; selected: boolean; onSelect: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid="rate-button"
      className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 px-3 py-1.5 text-center leading-tight transition app:min-h-16 ${
        wide ? "min-w-40" : "min-w-24"
      } ${selected ? "border-brand bg-brand text-white shadow-md" : "border-sky-200 bg-white text-foreground hover:border-sky-500 dark:border-sky-900 dark:bg-surface"}`}
    >
      <span className="text-sm font-semibold app:text-base">{button.label}</span>
      <span className={`mt-0.5 text-base font-black app:text-lg ${selected ? "text-white" : "text-sky-700 dark:text-sky-300"}`}>{formatRateTag(button.rateMinor)}</span>
    </button>
  );
}

/** A row of buttons that wraps on large screens and scrolls sideways on phones. */
export function ButtonRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="app-scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {children}
    </div>
  );
}

/** The blue title bar of a section (and of a second button row). */
export function RateBar({ children, as: Tag = "h2", id, small = false }: { children: ReactNode; as?: "h2" | "h3" | "p"; id?: string; small?: boolean }) {
  return (
    <Tag
      id={id}
      className={`rounded-lg bg-gradient-to-r from-sky-700 to-cyan-600 px-4 text-center font-bold text-white shadow-sm ${small ? "py-2 text-base" : "py-3 text-lg sm:text-xl"}`}
    >
      {children}
    </Tag>
  );
}

type SideText = { value: string; inches: string };
const empty: SideText = { value: "", inches: "" };
const toNumber = (s: string) => (s.trim() === "" ? 0 : Number(s));

export function CalculatorRow({
  rule,
  selection,
  designChargeMinor,
  minOrderMinor,
  hint = "Tap a rate",
  onAutoSelect,
}: {
  rule: PricingRule;
  selection: Selection;
  designChargeMinor: number;
  minOrderMinor: number | null;
  hint?: string;
  /** A single-rate section (a sign board quality): CHECK without a click selects that rate. */
  onAutoSelect?: () => Selection;
}) {
  const [unit, setUnit] = useState<SizeUnit>("ft-in");
  const [width, setWidth] = useState<SideText>(empty);
  const [height, setHeight] = useState<SideText>(empty);
  const [checked, setChecked] = useState<{ quote: RateQuote; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [details, setDetails] = useState({ name: "", phone: "", city: "", note: "" });
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const router = useRouter();

  const size = {
    unit,
    width: { value: toNumber(width.value), inches: unit === "ft-in" ? toNumber(width.inches) : undefined },
    height: { value: toNumber(height.value), inches: unit === "ft-in" ? toNumber(height.inches) : undefined },
  };
  // A result belongs to the exact size and rate it was checked with; any change asks for CHECK again.
  const key = JSON.stringify([size, selection?.button.id, selection?.button.rateMinor]);
  const quote = checked && checked.key === key ? checked.quote : null;

  function check() {
    setOrderError(null);
    const chosen = selection ?? onAutoSelect?.() ?? null;
    if (!chosen) {
      setError("Choose a rate first: click one of the rate buttons.");
      return;
    }
    const result = quoteRate(size, { rule, rateMinor: chosen.button.rateMinor, designChargeMinor, minOrderMinor });
    if (!result.ok) {
      setError(result.error);
      setChecked(null);
      return;
    }
    setError(null);
    setChecked({ quote: result.quote, key: JSON.stringify([size, chosen.button.id, chosen.button.rateMinor]) });
  }

  function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !selection) return;
    setOrderError(null);
    // Opened now, while the click still counts as the customer's action, so pop-up blockers allow it.
    const whatsappTab = window.open("about:blank", "_blank");
    startPlacing(async () => {
      try {
        const res = await placeRateOrderAction({ itemId: selection.itemId, variantId: selection.variantId ?? "", ...size, quantity: 1, ...details });
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

  const sideFields = (label: "Width" | "Height", value: SideText, set: (v: SideText) => void) => (
    <div className="col-span-2 min-w-0 sm:col-span-1">
      <span className="label">{label}</span>
      {unit === "ft-in" ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Suffixed suffix="ft">
            <input inputMode="decimal" className="input pr-8" value={value.value} onChange={(e) => set({ ...value, value: e.target.value })} placeholder="0" aria-label={`${label} (ft)`} />
          </Suffixed>
          <Suffixed suffix="in">
            <input inputMode="decimal" className="input pr-8" value={value.inches} onChange={(e) => set({ ...value, inches: e.target.value })} placeholder="0" aria-label={`${label} (in)`} />
          </Suffixed>
        </div>
      ) : (
        <Suffixed suffix={unit}>
          <input inputMode="decimal" className="input pr-12" value={value.value} onChange={(e) => set({ ...value, value: e.target.value })} placeholder="0" aria-label={`${label} (${unit})`} />
        </Suffixed>
      )}
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3 sm:p-4 dark:border-sky-900 dark:bg-sky-950/20" data-testid="rate-calculator">
      <div className="grid gap-3 lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:items-stretch">
        <p className="grid place-items-center rounded-lg bg-sky-700 px-3 py-2 text-center text-sm font-black uppercase leading-snug tracking-wide text-white">
          Enter your size – check your price
        </p>
        <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[6.5rem_1.3fr_1.3fr_0.8fr_0.9fr_auto_1fr]">
          <label className="col-span-2 block xl:col-span-1">
            <span className="label">Unit</span>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as SizeUnit)} aria-label="Unit">
              {SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
          {sideFields("Width", width, setWidth)}
          {sideFields("Height", height, setHeight)}
          <label className="block">
            <span className="label">Rate</span>
            <input
              className="input cursor-not-allowed bg-surface font-bold"
              readOnly
              aria-readonly
              value={selection ? formatRateTag(selection.button.rateMinor) : ""}
              placeholder={hint}
              aria-label="Rate per sq ft"
              data-testid="calc-rate"
            />
          </label>
          <label className="block">
            <span className="label">Designing Charges</span>
            <input className="input cursor-not-allowed bg-surface font-bold" readOnly aria-readonly value={formatRateTag(designChargeMinor)} aria-label="Designing Charges" data-testid="calc-design" />
          </label>
          <button type="button" className="btn-primary h-[2.625rem] px-6 font-black tracking-wide app:h-12" onClick={check} data-testid="calc-check">
            CHECK
          </button>
          <div className="block">
            <span className="label">Total Price</span>
            <output className="input flex items-center bg-surface text-lg font-black text-brand" aria-label="Total Price" data-testid="calc-total">
              {quote ? formatRs(quote.totalMinor) : "—"}
            </output>
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">{rule === "STICKER" ? "Stickers: priced on our 4.5 ft wide media roll." : "Each side is charged to the next full foot."}</p>
      {error && (
        <p className="field-error mt-2" role="alert">
          {error}
        </p>
      )}

      {quote && selection && (
        <>
          <dl className="mt-3 grid gap-x-6 rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:grid-cols-2" data-testid="calc-breakdown" aria-live="polite">
            <Row label="Selected" value={selection.name} />
            <Row label="Size entered" value={quote.sizeText} testId="calc-size" />
            <Row label="Billable size" value={quote.billableText} testId="calc-billable" />
            <Row label="Billable sq ft" value={`${quote.sqftText} sq ft`} testId="calc-sqft" />
            <Row label="Rate" value={`${formatRs(quote.rateMinor)} per sq ft`} />
            {quote.minimumApplied && <Row label="Printing (minimum order)" value={formatRs(quote.printingMinor)} />}
            <Row label="Designing charges" value={formatRs(quote.designChargeMinor)} />
            <Row label="Total" value={formatRs(quote.totalMinor)} strong />
          </dl>
          {!checkout ? (
            <button type="button" className="btn-primary mt-3 w-full py-3 text-base" onClick={() => setCheckout(true)} data-testid="rate-order-now">
              Order now
            </button>
          ) : (
            <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={placeOrder} aria-label="Your details">
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
                <p className="field-error sm:col-span-2" role="alert">
                  {orderError}
                </p>
              )}
              <button className="btn w-full bg-green-600 py-3 text-base text-white hover:bg-green-700 sm:col-span-2" disabled={placing}>
                {placing ? "Saving your order…" : "Confirm & continue on WhatsApp"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function Suffixed({ suffix, children }: { suffix: string; children: ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
    </span>
  );
}

function Row({ label, value, testId, strong = false }: { label: string; value: string; testId?: string; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-border py-1.5 last:border-0 ${strong ? "text-base font-black" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="text-right font-semibold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
