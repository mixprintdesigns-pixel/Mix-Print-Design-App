"use client";

import { useActionState } from "react";
import { contactAction, type ContactState } from "@/app/contact/actions";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm({ subject }: { subject?: string }) {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(contactAction, {});
  const errors = state.errors ?? {};
  const described = (id: string) => (errors[id] ? `${id}-error` : undefined);

  if (state.ok) {
    return (
      <div className="rounded-xl bg-green-50 p-6 text-green-900 dark:bg-green-950 dark:text-green-200" role="status">
        <p className="text-lg font-semibold">Thank you! Your message has been sent.</p>
        <p className="mt-1 text-sm">We will reply by email or phone soon. For urgent work, message us on WhatsApp.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      {/* Honeypot field, hidden from people and screen readers */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Company <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name}>
          <input id="name" name="name" autoComplete="name" className="input" required aria-describedby={described("name")} />
        </Field>
        <Field id="phone" label="Phone / WhatsApp" error={errors.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder="0300 1234567" aria-describedby={described("phone")} />
        </Field>
      </div>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" className="input" required aria-describedby={described("email")} />
      </Field>
      <Field id="subject" label="Subject (optional)" error={errors.subject}>
        <input id="subject" name="subject" className="input" defaultValue={subject} maxLength={150} />
      </Field>
      <Field id="message" label="Message" error={errors.message}>
        <textarea
          id="message"
          name="message"
          rows={5}
          className="input"
          required
          placeholder="What would you like printed? Size, quantity and deadline help us quote quickly."
          aria-describedby={described("message")}
        />
      </Field>
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
