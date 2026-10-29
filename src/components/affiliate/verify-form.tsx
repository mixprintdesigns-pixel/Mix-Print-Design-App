"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { resendSignupCodeAction, verifySignupAction, type VerifyState } from "@/app/affiliate/actions";

type Status = { email: string; phone: string; needsEmail: boolean; needsPhone: boolean; emailResendIn: number; phoneResendIn: number };

function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}

function ResendButton({ channel, initialWait }: { channel: "email" | "phone"; initialWait: number }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(resendSignupCodeAction, {});
  const [left, setLeft] = useCountdown(initialWait);
  useEffect(() => {
    if (state.message) setLeft(60);
  }, [state, setLeft]);
  return (
    <form action={action} className="mt-1 text-sm">
      <input type="hidden" name="channel" value={channel} />
      <button className="font-semibold text-brand disabled:text-muted" disabled={pending || left > 0}>
        {pending ? "Sending…" : left > 0 ? `Resend code in ${left}s` : "Resend code"}
      </button>
      {state.message && (
        <span className="ml-2 text-green-700 dark:text-green-400" role="status">
          {state.message}
        </span>
      )}
      {state.error && (
        <span className="field-error ml-2" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

function CodeInput({ id, label, sentTo, error, verified }: { id: string; label: string; sentTo: string; error?: string | null; verified: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <p className="mb-2 text-xs text-muted">Sent to {sentTo}</p>
      {verified ? (
        <p className="rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
          ✓ Verified
        </p>
      ) : (
        <input
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="6-digit code"
          className="input max-w-48 text-center font-mono text-lg tracking-[0.4em]"
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
        />
      )}
      {error && !verified && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function VerifyForm({ status }: { status: Status }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifySignupAction, {});
  const emailVerified = !status.needsEmail || Boolean(state.emailVerified);
  const phoneVerified = !status.needsPhone || Boolean(state.phoneVerified);

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-accent/10 p-3 text-sm" role="status">
        We sent {status.needsEmail && status.needsPhone ? "two 6-digit codes: one to your email and one by SMS" : status.needsEmail ? "a 6-digit code to your email" : "a 6-digit code by SMS"}.
        Codes are valid for 10 minutes.
      </p>
      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {state.error}{" "}
          <Link href="/affiliate/join" className="font-semibold underline">
            Start again
          </Link>
        </p>
      )}

      <form action={action} className="space-y-5" noValidate>
        {status.needsEmail && <CodeInput id="emailCode" label="Email code" sentTo={status.email} error={state.emailError} verified={emailVerified} />}
        {status.needsPhone && <CodeInput id="phoneCode" label="Mobile code (SMS)" sentTo={status.phone} error={state.phoneError} verified={phoneVerified} />}
        <button className="btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Checking…" : "Verify & activate"}
        </button>
      </form>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted">Didn&apos;t get a code? Check spam, or ask for a new one.</p>
        {status.needsEmail && !emailVerified && (
          <div>
            <p className="text-sm font-medium">Email code</p>
            <ResendButton channel="email" initialWait={status.emailResendIn} />
          </div>
        )}
        {status.needsPhone && !phoneVerified && (
          <div>
            <p className="text-sm font-medium">Mobile code</p>
            <ResendButton channel="phone" initialWait={status.phoneResendIn} />
          </div>
        )}
      </div>
    </div>
  );
}
