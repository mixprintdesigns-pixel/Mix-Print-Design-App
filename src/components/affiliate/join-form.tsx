"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { applyAction, type AffiliateFormState } from "@/app/affiliate/actions";
import { PayoutFields } from "./payout-fields";

function AccountField({ id, label, error, ...input }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} name={id} className="input" aria-describedby={error ? `${id}-error` : undefined} {...input} />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Affiliate signup. `newAccount` shows name, email and password for visitors without an account;
 * everyone gives a mobile number (for payouts). The email is verified by code; the number is verified
 * by SMS only when `smsVerification` is on.
 */
export function JoinForm({
  phone,
  name,
  reapplying,
  newAccount = false,
  smsVerification = false,
}: {
  phone: string | null;
  name: string;
  reapplying: boolean;
  newAccount?: boolean;
  smsVerification?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(applyAction, {});
  const errors = state.errors ?? {};
  return (
    <form
      className="space-y-5"
      noValidate
      // Submitted via onSubmit (not the form `action` prop) so React doesn't clear the form when
      // the server reports a mistake: visitors only fix the highlighted field.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {errors._form && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {errors._form}
        </p>
      )}
      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold">{newAccount ? "Your account" : "Your mobile number"}</legend>
        {newAccount && (
          <>
            <AccountField id="name" label="Full name" autoComplete="name" error={errors.name} />
            <AccountField id="email" label="Email" type="email" autoComplete="email" error={errors.email} />
          </>
        )}
        <AccountField
          id="phone"
          label="Mobile number (Pakistan)"
          type="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          defaultValue={phone?.replace(/^\+92/, "0") ?? ""}
          error={errors.phone}
        />
        {newAccount && (
          <AccountField id="password" label="Password" type="password" autoComplete="new-password" error={errors.password} />
        )}
        {smsVerification ? (
          <p className="text-xs text-muted">
            We will send a 6-digit code {newAccount ? "to your email and another" : "to confirm your number"} by SMS. Your affiliate account is
            activated only after you enter {newAccount ? "both codes" : "the code"}.
          </p>
        ) : (
          <p className="text-xs text-muted">We will send a 6-digit code to your email. Your affiliate account is activated after you enter it.</p>
        )}
      </fieldset>
      <PayoutFields errors={errors} defaults={{ payoutAccount: phone, payoutAccountName: name }} />
      <div>
        <label htmlFor="website" className="label">
          Website or social profile <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="website" name="website" className="input" placeholder="instagram.com/yourpage" />
      </div>
      <div>
        <label htmlFor="promotionPlan" className="label">
          How will you promote Mix Print Design?
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
            , including no spam, no paid search ads on the Mix Print Design brand name, and no self-referrals.
          </span>
        </label>
        {errors.agreeTerms && <p className="field-error">{errors.agreeTerms}</p>}
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending
          ? smsVerification ? "Sending codes…" : "Sending code…"
          : reapplying
            ? "Apply again"
            : newAccount
              ? smsVerification ? "Create account & send codes" : "Create account & send code"
              : "Submit application"}
      </button>
    </form>
  );
}
