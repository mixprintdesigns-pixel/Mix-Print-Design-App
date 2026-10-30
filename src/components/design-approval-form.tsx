"use client";

import { useActionState } from "react";
import { respondToProofAction, type ApprovalState } from "@/app/design-approval/actions";

/** Approve the design, or ask for changes with a comment. */
export function DesignApprovalForm({ token, proofId }: { token: string; proofId: string }) {
  const [state, formAction, pending] = useActionState<ApprovalState, FormData>(respondToProofAction, {});
  if (state.done) {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
        {state.done === "APPROVED"
          ? "Thank you! You approved this design. We will start printing and keep you updated on WhatsApp."
          : "Thank you! We received your comments and will send you an updated design soon."}
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="proofId" value={proofId} />
      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="label">Comments (needed if you want changes)</span>
        <textarea name="comment" rows={3} maxLength={2000} className="input" placeholder="e.g. Make the phone number bigger and use a darker blue." />
      </label>
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="APPROVED" className="btn-primary" disabled={pending}>
          Approve design
        </button>
        <button name="decision" value="CHANGES_REQUESTED" className="btn-secondary" disabled={pending}>
          Request changes
        </button>
      </div>
    </form>
  );
}
