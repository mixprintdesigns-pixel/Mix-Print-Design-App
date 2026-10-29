import { setAffiliateRateAction, setAffiliateStatusAction } from "@/app/admin/affiliate-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateTabs, StatusBadge } from "@/components/admin/affiliate-tabs";
import { requireStaff } from "@/lib/auth/session";
import { getAffiliateSettings, getProgramTotals, listAffiliatesForAdmin } from "@/lib/affiliate/service";
import { PAYOUT_LABEL } from "@/lib/affiliate/validation";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";

export const metadata = { title: "Affiliates" };

export default async function AdminAffiliatesPage({ searchParams }: PageProps<"/admin/affiliates">) {
  await requireStaff(["ADMIN"]);
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q : "";
  const [affiliates, totals, settings] = await Promise.all([
    listAffiliatesForAdmin({ status, q }),
    getProgramTotals(),
    getAffiliateSettings(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Affiliates & commissions</h1>
      <AffiliateTabs current="/admin/affiliates" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Program totals">
        {[
          ["Active affiliates", totals.affiliates.toString()],
          ["Applications to review", totals.pendingApplications.toString()],
          ["Referral clicks", totals.clicks.toLocaleString()],
          ["Commission owed", formatPKR(totals.owedMinor)],
          ["Commission paid", formatPKR(totals.paidMinor)],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {totals.requestedCount > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {totals.requestedCount} withdrawal request{totals.requestedCount > 1 ? "s" : ""} waiting ({formatPKR(totals.requestedMinor)}).{" "}
          <a href="/admin/affiliates/withdrawals" className="font-semibold underline">
            Review
          </a>
        </p>
      )}

      <form action="/admin/affiliates" className="mt-6 flex flex-wrap gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Search name, email or code" className="input max-w-xs" aria-label="Search affiliates" />
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="">All statuses</option>
          <option value="PENDING">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {affiliates.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-muted">No affiliates found.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {affiliates.map((a) => (
            <li key={a.id} className="card p-5" data-testid="affiliate-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {a.user.name} <StatusBadge status={a.status} />
                  </p>
                  <p className="text-sm text-muted">
                    {a.user.email}
                    {a.user.phone ? ` · ${a.user.phone}` : ""} · code <span className="font-mono">{a.code}</span>
                  </p>
                  <p className="text-xs text-muted">Joined {a.createdAt.toLocaleDateString("en-PK")}</p>
                </div>
                <dl className="grid grid-cols-4 gap-4 text-right text-sm">
                  <div>
                    <dt className="text-xs text-muted">Clicks</dt>
                    <dd className="font-semibold">{a._count.clicks}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Orders</dt>
                    <dd className="font-semibold">{a.orders}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Earned</dt>
                    <dd className="font-semibold">{formatPKR(a.earnedMinor)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Paid</dt>
                    <dd className="font-semibold">{formatPKR(a.paidMinor)}</dd>
                  </div>
                </dl>
              </div>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-brand">Application & payout details</summary>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Website / social</dt>
                    <dd>{a.website ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Payout</dt>
                    <dd>
                      {a.payoutMethod ? `${PAYOUT_LABEL[a.payoutMethod]} · ${a.payoutAccount} (${a.payoutAccountName})` : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted">How they will promote</dt>
                    <dd className="whitespace-pre-line">{a.promotionPlan ?? "—"}</dd>
                  </div>
                  {a.adminNote && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted">Note to affiliate</dt>
                      <dd>{a.adminNote}</dd>
                    </div>
                  )}
                </dl>
              </details>

              <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-2">
                <ActionForm action={setAffiliateStatusAction}>
                  <input type="hidden" name="affiliateId" value={a.id} />
                  <input name="note" placeholder="Reason (for reject / suspend)" className="input max-w-56 py-1.5 text-xs" aria-label="Reason" />
                  {a.status !== "APPROVED" && (
                    <SubmitButton name="status" value="APPROVED" className="btn-primary px-3 py-1.5 text-xs">
                      {a.status === "SUSPENDED" ? "Reactivate" : "Approve"}
                    </SubmitButton>
                  )}
                  {a.status === "PENDING" && (
                    <SubmitButton name="status" value="REJECTED">
                      Reject
                    </SubmitButton>
                  )}
                  {a.status === "APPROVED" && (
                    <SubmitButton name="status" value="SUSPENDED">
                      Suspend
                    </SubmitButton>
                  )}
                </ActionForm>
                <ActionForm action={setAffiliateRateAction}>
                  <input type="hidden" name="affiliateId" value={a.id} />
                  <label className="text-xs text-muted" htmlFor={`rate-${a.id}`}>
                    Custom rate %
                  </label>
                  <input
                    id={`rate-${a.id}`}
                    name="rate"
                    defaultValue={a.commissionRateBps === null ? "" : String(a.commissionRateBps / 100)}
                    placeholder={`default ${formatPercent(settings.defaultRateBps)}`}
                    className="input w-32 py-1.5 text-xs"
                  />
                  <SubmitButton>Save rate</SubmitButton>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
