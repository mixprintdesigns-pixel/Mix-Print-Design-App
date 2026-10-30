import { markWithdrawalPaidAction, rejectWithdrawalAction } from "@/app/admin/affiliate-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateTabs, StatusBadge, StatusFilter } from "@/components/admin/affiliate-tabs";
import { requireStaff } from "@/lib/auth/session";
import { listWithdrawalsForAdmin } from "@/lib/affiliate/service";
import { PAYOUT_LABEL } from "@/lib/affiliate/validation";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Affiliate withdrawals" };

export default async function AdminWithdrawalsPage({ searchParams }: PageProps<"/admin/affiliates/withdrawals">) {
  await requireStaff(["ADMIN"]);
  const status = (await searchParams).status;
  const current = typeof status === "string" ? status : "";
  const withdrawals = await listWithdrawalsForAdmin({ status: current });

  return (
    <>
      <h1 className="text-2xl font-bold">Affiliates & commissions</h1>
      <AffiliateTabs current="/admin/affiliates/withdrawals" />
      <StatusFilter action="/admin/affiliates/withdrawals" current={current} options={["REQUESTED", "PAID", "REJECTED"]} />
      <p className="mt-3 text-sm text-muted">
        Send the money from your JazzCash, Easypaisa or bank account, then record the transaction reference here.
      </p>

      {withdrawals.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-muted">No withdrawal requests.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {withdrawals.map((w) => (
            <li key={w.id} className="card p-5" data-testid="withdrawal-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold">{formatPKR(w.amountMinor)}</p>
                  <p className="text-sm">
                    {w.affiliate.user.name} <span className="text-muted">({w.affiliate.user.email})</span>
                  </p>
                  <p className="text-xs text-muted">
                    Requested {w.requestedAt.toLocaleString("en-PK")} · {w._count.commissions} commission
                    {w._count.commissions === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <StatusBadge status={w.status} />
                  <p className="mt-1 font-semibold">{PAYOUT_LABEL[w.method]}</p>
                  <p className="font-mono">{w.account}</p>
                  <p className="text-muted">{w.accountName}</p>
                </div>
              </div>
              {w.status === "REQUESTED" ? (
                <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-2">
                  <ActionForm action={markWithdrawalPaidAction} confirm={`Confirm you have sent ${formatPKR(w.amountMinor)}?`}>
                    <input type="hidden" name="withdrawalId" value={w.id} />
                    <input name="transactionRef" placeholder="Transaction reference" className="input max-w-56 py-1.5 text-xs" aria-label="Transaction reference" />
                    <input
                      name="paidAt"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="input w-auto py-1.5 text-xs"
                      aria-label="Date paid"
                    />
                    <select name="paidMethod" defaultValue={w.method} className="input w-auto py-1.5 text-xs" aria-label="Paid by">
                      <option value="JAZZCASH">JazzCash</option>
                      <option value="EASYPAISA">Easypaisa</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                    </select>
                    <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Mark as paid</SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectWithdrawalAction}>
                    <input type="hidden" name="withdrawalId" value={w.id} />
                    <input name="adminNote" placeholder="Reason for rejecting" className="input max-w-56 py-1.5 text-xs" aria-label="Reason for rejecting" />
                    <SubmitButton>Reject</SubmitButton>
                  </ActionForm>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  {w.status === "PAID" ? `Paid ${w.processedAt?.toLocaleDateString("en-PK")} by ${({ JAZZCASH: "JazzCash", EASYPAISA: "Easypaisa", BANK_TRANSFER: "bank transfer" })[w.paidMethod ?? w.method]} · ref ${w.transactionRef}` : `Rejected: ${w.adminNote}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
