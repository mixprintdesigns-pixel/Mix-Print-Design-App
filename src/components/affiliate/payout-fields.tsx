"use client";

import { useState } from "react";
import { PAYOUT_LABEL, PAYOUT_METHODS, type PayoutMethodValue } from "@/lib/affiliate/validation";

/** Payout method, account and account title inputs, shared by the join form and the dashboard. */
export function PayoutFields({
  errors,
  defaults,
}: {
  errors: Record<string, string>;
  defaults: { payoutMethod?: PayoutMethodValue | null; payoutAccount?: string | null; payoutAccountName?: string | null };
}) {
  const [method, setMethod] = useState<PayoutMethodValue>(defaults.payoutMethod ?? "JAZZCASH");
  const isBank = method === "BANK_TRANSFER";
  // Show stored +92 numbers in the local 03xx format people recognise.
  const account = defaults.payoutAccount?.replace(/^\+92/, "0") ?? "";

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">How should we pay you?</legend>
        <div className="flex flex-wrap gap-2">
          {PAYOUT_METHODS.map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${method === m ? "border-brand bg-brand/10 font-semibold" : "border-border"}`}
            >
              <input type="radio" name="payoutMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {PAYOUT_LABEL[m]}
            </label>
          ))}
        </div>
        {errors.payoutMethod && <p className="field-error">{errors.payoutMethod}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="payoutAccount" className="label">
            {isBank ? "IBAN" : "Wallet mobile number"}
          </label>
          <input
            id="payoutAccount"
            name="payoutAccount"
            className="input"
            defaultValue={account}
            placeholder={isBank ? "PK36 SCBL 0000 0011 2345 6702" : "0300 1234567"}
            aria-describedby="payoutAccount-error"
          />
          {errors.payoutAccount && (
            <p id="payoutAccount-error" className="field-error">
              {errors.payoutAccount}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="payoutAccountName" className="label">
            Account title <span className="font-normal text-muted">(if different from your name)</span>
          </label>
          <input id="payoutAccountName" name="payoutAccountName" className="input" defaultValue={defaults.payoutAccountName ?? ""} />
          {errors.payoutAccountName && <p className="field-error">{errors.payoutAccountName}</p>}
        </div>
      </div>
    </div>
  );
}
