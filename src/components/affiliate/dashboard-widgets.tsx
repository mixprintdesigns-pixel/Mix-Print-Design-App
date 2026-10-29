"use client";

import { useActionState, useState } from "react";
import { requestWithdrawalAction, updatePayoutAction, type AffiliateFormState } from "@/app/affiliate/actions";
import type { PayoutMethodValue } from "@/lib/affiliate/validation";
import { PayoutFields } from "./payout-fields";

export function CopyField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} className="input font-mono text-xs" aria-label={label} data-testid={testId} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function LinkBuilder({ baseLink, products }: { baseLink: string; products: { slug: string; name: string }[] }) {
  const [slug, setSlug] = useState("");
  const link = slug ? `${baseLink}?to=${encodeURIComponent(`/products/${slug}`)}` : "";
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="link-product" className="label">
          Link to a specific product
        </label>
        <select id="link-product" className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">Choose a product…</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {link && <CopyField label="Product link" value={link} testId="product-link" />}
    </div>
  );
}

export function WithdrawButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<AffiliateFormState>(requestWithdrawalAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <button className="btn-primary w-full" disabled={disabled || pending}>
        {pending ? "Requesting…" : "Withdraw available balance"}
      </button>
      {state.errors?._form && (
        <p className="field-error" role="alert">
          {state.errors._form}
        </p>
      )}
      {state.message && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function PayoutForm({
  defaults,
}: {
  defaults: { payoutMethod: PayoutMethodValue | null; payoutAccount: string | null; payoutAccountName: string | null };
}) {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(updatePayoutAction, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <PayoutFields errors={state.errors ?? {}} defaults={defaults} />
      <div className="flex items-center gap-3">
        <button className="btn-secondary" disabled={pending}>
          {pending ? "Saving…" : "Save payout details"}
        </button>
        {state.message && (
          <span className="text-sm text-green-700 dark:text-green-400" role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
