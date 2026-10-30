"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, requestResetAction, resetPasswordAction, type AuthFormState, type ResetFormState } from "@/app/actions/auth";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="field-error">{errors[0]}</p> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={state.values?.email} />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="text-sm font-semibold text-brand">
            Forgot password?
          </Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        New to Mix Print Design?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-brand">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" autoComplete="name" required className="input" defaultValue={state.values?.name} />
        <FieldError errors={state.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={state.values?.email} />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div>
        <label htmlFor="phone" className="label">
          Mobile number <span className="font-normal text-muted">(for JazzCash / Easypaisa and delivery)</span>
        </label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="0300 1234567" className="input" defaultValue={state.values?.phone} />
        <FieldError errors={state.fieldErrors?.phone} />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
        <p className="mt-1 text-xs text-muted">At least 10 characters, with letters and numbers.</p>
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function FormAlert({ message }: { message?: string }) {
  return message ? (
    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
      {message}
    </p>
  ) : null;
}

/** "Forgot password": first the email, then the emailed code and the new password. */
export function ForgotPasswordForm() {
  const [requested, requestAction, requesting] = useActionState<ResetFormState, FormData>(requestResetAction, {});
  const [reset, resetAction, resetting] = useActionState<ResetFormState, FormData>(resetPasswordAction, {});
  const email = reset.email ?? requested.email;

  if (requested.step !== "code" || !email) {
    return (
      <form action={requestAction} className="space-y-4" noValidate>
        <FormAlert message={requested.error} />
        <p className="text-sm text-muted">Enter your account email. We will send you a 6-digit code to set a new password.</p>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={requested.values?.email} />
          <FieldError errors={requested.fieldErrors?.email} />
        </div>
        <button className="btn-primary w-full" disabled={requesting}>
          {requesting ? "Sending…" : "Send code"}
        </button>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand">Back to sign in</Link>
        </p>
      </form>
    );
  }

  return (
    <form action={resetAction} className="space-y-4" noValidate>
      <input type="hidden" name="email" value={email} />
      <p className="rounded-lg border border-border bg-surface p-3 text-sm" role="status">
        If <strong>{email}</strong> has an account, a code is on its way. Check your inbox and spam folder.
      </p>
      <FormAlert message={reset.error} />
      <div>
        <label htmlFor="code" className="label">6-digit code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="input tracking-widest" />
        <FieldError errors={reset.fieldErrors?.code} />
      </div>
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
        <p className="mt-1 text-xs text-muted">At least 10 characters, with letters and numbers.</p>
        <FieldError errors={reset.fieldErrors?.password} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
        <FieldError errors={reset.fieldErrors?.confirm} />
      </div>
      <button className="btn-primary w-full" disabled={resetting}>
        {resetting ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
