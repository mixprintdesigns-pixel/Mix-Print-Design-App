import Link from "next/link";
import { approveCommissionAction, approveDueCommissionsAction, reverseCommissionAction } from "@/app/admin/affiliate-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateTabs, StatusBadge, StatusFilter } from "@/components/admin/affiliate-tabs";
import { requireStaff } from "@/lib/auth/session";
import { getAffiliateSettings, listCommissionsForAdmin } from "@/lib/affiliate/service";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Affiliate commissions" };

export default async function AdminCommissionsPage({ searchParams }: PageProps<"/admin/affiliates/commissions">) {
  await requireStaff(["ADMIN"]);
  const status = (await searchParams).status;
  const current = typeof status === "string" ? status : "";
  const [commissions, settings] = await Promise.all([listCommissionsForAdmin({ status: current }), getAffiliateSettings()]);

  return (
    <>
      <h1 className="text-2xl font-bold">Affiliates & commissions</h1>
      <AffiliateTabs current="/admin/affiliates/commissions" />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <StatusFilter action="/admin/affiliates/commissions" current={current} options={["PENDING", "APPROVED", "PAID", "REVERSED"]} />
        <ActionForm action={approveDueCommissionsAction}>
          <SubmitButton className="btn-primary">Approve due commissions</SubmitButton>
          <span className="text-xs text-muted">Delivered more than {settings.holdDays} days ago</span>
        </ActionForm>
      </div>
      <p className="mt-3 text-sm text-muted">
        Commissions are created automatically when a referred customer places an order, and reversed automatically if the order is
        cancelled or refunded.
      </p>

      {commissions.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-muted">No commissions yet.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Order</th>
                <th className="p-3 font-medium">Affiliate</th>
                <th className="p-3 font-medium">Base</th>
                <th className="p-3 font-medium">Commission</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-border align-top last:border-0" data-testid="commission-row">
                  <td className="p-3">
                    <span className="font-mono">{c.order.number}</span>
                    <span className="block text-xs text-muted">order {c.order.status.toLowerCase().replace(/_/g, " ")}</span>
                  </td>
                  <td className="p-3">
                    {c.affiliate.user.name}
                    <span className="block font-mono text-xs text-muted">{c.affiliate.code}</span>
                  </td>
                  <td className="p-3">{formatPKR(c.baseAmountMinor)}</td>
                  <td className="p-3 font-semibold">{formatPKR(c.amountMinor)}</td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                    {c.withdrawal?.status === "REQUESTED" && <span className="block text-xs text-muted">in withdrawal</span>}
                    {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                  </td>
                  <td className="space-y-2 p-3">
                    {c.status === "PENDING" && (
                      <ActionForm action={approveCommissionAction}>
                        <input type="hidden" name="commissionId" value={c.id} />
                        <SubmitButton>Approve now</SubmitButton>
                      </ActionForm>
                    )}
                    {(c.status === "PENDING" || c.status === "APPROVED") && (
                      <ActionForm action={reverseCommissionAction} confirm="Reverse this commission?">
                        <input type="hidden" name="commissionId" value={c.id} />
                        <input name="note" placeholder="Reason" className="input w-36 py-1.5 text-xs" aria-label="Reason for reversal" />
                        <SubmitButton>Reverse</SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        <Link href="/admin/affiliates/settings" className="underline">
          Change the hold period and default rate
        </Link>
      </p>
    </>
  );
}
