"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/affiliate-actions";

/** A small form bound to an admin action that shows the action's success or error message. */
export function ActionForm({
  action,
  children,
  className = "flex flex-wrap items-center gap-2",
  confirm: confirmText,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Ask before submitting, for actions that move money. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      {state.error && (
        <span className="field-error w-full" role="alert">
          {state.error}
        </span>
      )}
      {state.message && !pending && (
        <span className="w-full text-xs text-green-700 dark:text-green-400" role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function SubmitButton({ children, className = "btn-secondary px-3 py-1.5 text-xs", name, value }: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} name={name} value={value}>
      {children}
    </button>
  );
}
