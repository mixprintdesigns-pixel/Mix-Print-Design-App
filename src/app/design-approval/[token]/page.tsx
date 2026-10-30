import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DesignApprovalForm } from "@/components/design-approval-form";
import { DESIGN_STATUS_LABELS, getApprovalView, PROOF_RESPONSE_LABELS } from "@/lib/admin-sections/design-work";
import { formatKarachiDate } from "@/lib/admin-sections/shared";

// The customer's private design approval page, opened from the link staff send on WhatsApp or email.

export const metadata: Metadata = { title: "Design approval", robots: { index: false, follow: false } };

export default function Page({ params }: PageProps<"/design-approval/[token]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex justify-center">
        <BrandLogo className="h-12 w-auto" priority />
      </div>
      <Suspense fallback={<div className="card mt-8 h-96 animate-pulse" />}>
        <Approval params={params} />
      </Suspense>
    </div>
  );
}

async function Approval({ params }: { params: PageProps<"/design-approval/[token]">["params"] }) {
  const { token } = await params;
  const view = await getApprovalView(token);
  if (!view) {
    return (
      <div className="card mt-8 p-8 text-center">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="mt-2 text-muted">This design approval link is not valid. Please ask us on WhatsApp for a new link.</p>
      </div>
    );
  }
  const [latest, ...older] = view.proofs;

  return (
    <>
      <h1 className="mt-6 text-center text-3xl font-bold">Your design for order {view.orderNumber}</h1>
      <p className="mt-2 text-center text-muted">
        {view.customerName ? `${view.customerName}, please` : "Please"} check the design below and approve it, or tell us what to change.
      </p>
      <p className="mt-1 text-center text-sm text-muted">
        {view.items.map((i) => `${i.quantity} × ${i.productName}`).join(", ")} · Status: {DESIGN_STATUS_LABELS[view.status]}
      </p>

      {!latest ? (
        <p className="card mt-8 p-8 text-center text-muted">Your design is being prepared. We will send it here soon.</p>
      ) : (
        <section className="card mt-8 p-5" aria-label="Latest design">
          <p className="text-sm font-semibold">
            Version {latest.version} · {formatKarachiDate(latest.createdAt, true)}
          </p>
          <a href={latest.url} target="_blank" rel="noreferrer" className="mt-3 block">
            {latest.isPdf ? (
              <span className="btn-secondary">Open the design (PDF) ↗</span>
            ) : (
              <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-surface">
                <Image src={latest.url} alt={`Design for order ${view.orderNumber}, version ${latest.version}`} fill sizes="(max-width: 768px) 100vw, 720px" className="object-contain" />
              </span>
            )}
          </a>
          {latest.staffNote && <p className="mt-3 text-sm">Note from Mix Print Design: {latest.staffNote}</p>}
          <div className="mt-5">
            {latest.response === "WAITING" ? (
              <DesignApprovalForm token={token} proofId={latest.id} />
            ) : (
              <p className="rounded-lg border border-border bg-surface p-4 text-sm" role="status">
                You answered: <strong>{PROOF_RESPONSE_LABELS[latest.response]}</strong>
                {latest.customerComment && <> · “{latest.customerComment}”</>}
              </p>
            )}
          </div>
        </section>
      )}

      {older.length > 0 && (
        <section className="mt-6" aria-label="Earlier versions">
          <h2 className="text-lg font-bold">Earlier versions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {older.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold text-brand">
                  Version {p.version}
                </a>
                <span className="text-muted">
                  {PROOF_RESPONSE_LABELS[p.response]}
                  {p.customerComment && ` · “${p.customerComment}”`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
