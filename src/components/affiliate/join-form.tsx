"use client";

import Link from "next/link";
import { useActionState } from "react";
import { applyAction, type AffiliateFormState } from "@/app/affiliate/actions";
import { PayoutFields } from "./payout-fields";

export function JoinForm({ phone, name, reapplying }: { phone: string | null; name: string; reapplying: boolean }) {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(applyAction, {});
  const errors = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {errors._form && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {errors._form}
        </p>
      )}
      <PayoutFields errors={errors} defaults={{ payoutAccount: phone, payoutAccountName: name }} />
      <div>
        <label htmlFor="website" className="label">
          Website or social profile <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="website" name="website" className="input" placeholder="instagram.com/yourpage" />
      </div>
      <div>
        <label htmlFor="promotionPlan" className="label">
          How will you promote MixPrint?
        </label>
        <textarea
          id="promotionPlan"
          name="promotionPlan"
          rows={3}
          className="input"
          placeholder="e.g. I run a small-business Facebook group with 5,000 members."
        />
        {errors.promotionPlan && <p className="field-error">{errors.promotionPlan}</p>}
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeTerms" className="mt-1" />
          <span>
            I agree to the{" "}
            <Link href="/affiliate#terms" className="font-semibold text-brand" target="_blank">
              affiliate terms
            </Link>
            , including no spam, no paid search ads on the MixPrint brand name, and no self-referrals.
          </span>
        </label>
        {errors.agreeTerms && <p className="field-error">{errors.agreeTerms}</p>}
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Submitting…" : reapplying ? "Apply again" : "Submit application"}
      </button>
    </form>
  );
}
