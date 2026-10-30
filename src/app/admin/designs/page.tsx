import Image from "next/image";
import { addDesignJobAction, updateDesignJobAction, uploadDesignProofAction } from "@/app/admin/sections-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Badge, EmptyState, FilterLinks } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import {
  approvalPath,
  DESIGN_STATUS_LABELS,
  DESIGN_STATUSES,
  listDesignJobs,
  ordersWithoutDesignJob,
  PROOF_RESPONSE_LABELS,
} from "@/lib/admin-sections/design-work";
import { formatKarachiDate } from "@/lib/admin-sections/shared";
import { absoluteUrl } from "@/lib/seo";

export const metadata = { title: "Design work" };

const statusTone = { PENDING: "grey", IN_PROGRESS: "blue", SENT_FOR_APPROVAL: "amber", APPROVED: "green" } as const;
const responseTone = { WAITING: "amber", APPROVED: "green", CHANGES_REQUESTED: "red" } as const;

export default async function DesignWorkPage({ searchParams }: PageProps<"/admin/designs">) {
  await requireStaff();
  const raw = (await searchParams).status;
  const status = DESIGN_STATUSES.find((s) => s === raw);
  const [jobs, suggestions] = await Promise.all([listDesignJobs(status), ordersWithoutDesignJob()]);

  return (
    <>
      <h1 className="text-2xl font-bold">Design work</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Orders that need a design. Upload each proof here, then send the customer their approval link: they can approve it or ask for
        changes with a comment. A new proof sets the status to &quot;Sent for approval&quot;; the customer&apos;s answer updates it.
      </p>

      <ActionForm action={addDesignJobAction} className="card mt-6 grid gap-3 p-5 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <label className="block">
          <span className="label">Order number</span>
          <input name="orderNumber" className="input uppercase" placeholder="MP-260001" list="design-order-numbers" maxLength={30} required />
          <datalist id="design-order-numbers">
            {suggestions.map((o) => (
              <option key={o.number} value={o.number}>
                {o.customerName ?? o.user?.name ?? ""}
              </option>
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">Design brief (optional)</span>
          <input name="brief" className="input" maxLength={2000} placeholder="e.g. 3D sign board, logo in gold, shop name in Urdu and English" />
        </label>
        <SubmitButton className="btn-primary">Add to design work</SubmitButton>
      </ActionForm>

      <FilterLinks base="/admin/designs" current={status ?? ""} options={DESIGN_STATUSES.map((s) => ({ value: s, label: DESIGN_STATUS_LABELS[s] }))} />

      {jobs.length === 0 ? (
        <EmptyState>{status ? "No design work with this status." : "No design work yet. Add an order above."}</EmptyState>
      ) : (
        <ul className="mt-4 space-y-4">
          {jobs.map((job) => {
            const link = absoluteUrl(approvalPath(job.approvalToken));
            const latest = job.proofs.at(-1);
            return (
              <li key={job.id} className="card p-5" data-testid="design-job">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {job.order?.number ?? "Order not found"}{" "}
                      <span className="font-normal text-muted">· {job.order?.customerName ?? job.order?.user?.name ?? "—"}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {job.order?.items.map((i) => `${i.quantity} × ${i.productName}`).join(", ")}
                      {job.order && ` · ordered ${formatKarachiDate(job.order.placedAt)}`}
                    </p>
                  </div>
                  <Badge tone={statusTone[job.status]}>{DESIGN_STATUS_LABELS[job.status]}</Badge>
                </div>

                <ActionForm action={updateDesignJobAction} className="mt-4 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                  <input type="hidden" name="jobId" value={job.id} />
                  <label className="block">
                    <span className="label">Status</span>
                    <select name="status" defaultValue={job.status} className="input" aria-label={`Design status for ${job.order?.number ?? job.id}`}>
                      {DESIGN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {DESIGN_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Brief</span>
                    <input name="brief" defaultValue={job.brief ?? ""} className="input" maxLength={2000} />
                  </label>
                  <SubmitButton>Save</SubmitButton>
                </ActionForm>

                <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm">
                  <p className="font-semibold">Customer approval link</p>
                  <p className="mt-1 break-all font-mono text-xs" data-testid="approval-link">
                    {link}
                  </p>
                  <a href={approvalPath(job.approvalToken)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand">
                    Open the customer&apos;s page ↗
                  </a>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold">Proofs ({job.proofs.length})</p>
                  {job.proofs.length > 0 && (
                    <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {job.proofs.map((p) => (
                        <li key={p.id} className="rounded-lg border border-border p-3 text-xs">
                          <a href={p.url} target="_blank" rel="noreferrer" className="block">
                            {p.mimeType === "application/pdf" ? (
                              <span className="flex h-24 items-center justify-center rounded bg-surface font-semibold text-muted">PDF · {p.fileName}</span>
                            ) : (
                              <span className="relative block h-24 overflow-hidden rounded bg-surface">
                                <Image src={p.url} alt={`Design proof version ${p.version}`} fill sizes="240px" className="object-contain" />
                              </span>
                            )}
                          </a>
                          <p className="mt-2 flex items-center justify-between gap-2">
                            <span className="font-semibold">Version {p.version}</span>
                            <Badge tone={responseTone[p.response]}>{PROOF_RESPONSE_LABELS[p.response]}</Badge>
                          </p>
                          <p className="text-muted">{formatKarachiDate(p.createdAt, true)}</p>
                          {p.staffNote && <p className="mt-1">Note: {p.staffNote}</p>}
                          {p.customerComment && <p className="mt-1 rounded bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Customer: {p.customerComment}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionForm action={uploadDesignProofAction} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="file" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-xs" aria-label={`Proof file for ${job.order?.number ?? job.id}`} />
                    <input name="staffNote" className="input w-auto flex-1 py-1.5 text-xs" placeholder="Note for the customer (optional)" maxLength={1000} />
                    <SubmitButton className="btn-primary px-3 py-1.5 text-xs">{latest ? "Upload new version" : "Upload proof"}</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
