import Link from "next/link";
import { recordPaymentAction } from "@/app/admin/sections-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Badge, EmptyState, FilterLinks, StatTile } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import {
  listCommissionPayouts,
  listOrderPayments,
  listRecentPayments,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATE_LABELS,
  type PaymentState,
} from "@/lib/admin-sections/payments";
import { formatKarachiDate, karachiToday } from "@/lib/admin-sections/shared";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Payments" };

const STATES: PaymentState[] = ["PAID", "PARTIAL", "UNPAID"];
const stateTone = { PAID: "green", PARTIAL: "amber", UNPAID: "red" } as const;

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireStaff();
  const query = await searchParams;
  const state = STATES.find((s) => s === query.status);
  const payout = query.payout === "PAID" || query.payout === "UNPAID" ? query.payout : undefined;
  const [allOrders, recent, commissions] = await Promise.all([listOrderPayments(), listRecentPayments(), listCommissionPayouts(payout)]);
  const orders = state ? allOrders.filter((o) => o.state === state) : allOrders;
  const outstanding = allOrders.reduce((sum, o) => sum + o.balanceMinor, 0);
  const unpaidCommission = commissions.filter((c) => !c.paid).reduce((sum, c) => sum + c.amountMinor, 0);

  return (
    <>
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Record money received against an order. &quot;Received&quot; is the larger of the amount entered on the Orders screen and the payments
        recorded here, so a payment entered in both places is not counted twice.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Balance still to collect" value={formatPKR(outstanding)} />
        <StatTile label="Unpaid orders" value={String(allOrders.filter((o) => o.state === "UNPAID").length)} hint={`${allOrders.filter((o) => o.state === "PARTIAL").length} partly paid`} />
        <StatTile label="Unpaid affiliate commission" value={formatPKR(unpaidCommission)} hint={payout ? "For the filter below" : undefined} />
      </div>

      <ActionForm action={recordPaymentAction} className="card mt-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="text-lg font-bold sm:col-span-2 lg:col-span-3">Record a payment</h2>
        <label className="block">
          <span className="label">Order number</span>
          <input name="orderNumber" className="input uppercase" placeholder="MP-260001" list="payment-order-numbers" maxLength={30} required />
          <datalist id="payment-order-numbers">
            {allOrders
              .filter((o) => o.balanceMinor > 0)
              .map((o) => (
                <option key={o.id} value={o.number}>
                  {o.customer} · balance {formatPKR(o.balanceMinor)}
                </option>
              ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">Amount (Rs)</span>
          <input name="amount" inputMode="decimal" className="input" placeholder="2500" required />
        </label>
        <label className="block">
          <span className="label">Method</span>
          <select name="method" className="input" defaultValue="CASH">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Date received</span>
          <input name="receivedOn" type="date" className="input" defaultValue={karachiToday()} required />
        </label>
        <label className="block">
          <span className="label">Reference (optional)</span>
          <input name="reference" className="input" maxLength={100} placeholder="Transaction ID / receipt no." />
        </label>
        <label className="block">
          <span className="label">Note (optional)</span>
          <input name="note" className="input" maxLength={500} placeholder="e.g. 50% advance" />
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton className="btn-primary">Record payment</SubmitButton>
        </div>
      </ActionForm>

      <section className="mt-8" aria-labelledby="order-payments">
        <h2 id="order-payments" className="text-lg font-bold">
          Order payment status
        </h2>
        <FilterLinks base="/admin/payments" current={state ?? ""} options={STATES.map((s) => ({ value: s, label: PAYMENT_STATE_LABELS[s] }))} />
        {orders.length === 0 ? (
          <EmptyState>No orders here.</EmptyState>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Total</th>
                  <th className="p-3 font-medium">Received</th>
                  <th className="p-3 font-medium">Balance</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0" data-testid="payment-order-row">
                    <td className="p-3">
                      <span className="font-semibold">{o.number}</span>
                      <span className="block text-xs text-muted">{formatKarachiDate(o.placedAt)}</span>
                    </td>
                    <td className="p-3">{o.customer}</td>
                    <td className="whitespace-nowrap p-3">{formatPKR(o.totalMinor)}</td>
                    <td className="whitespace-nowrap p-3">{formatPKR(o.receivedMinor)}</td>
                    <td className="whitespace-nowrap p-3">{formatPKR(o.balanceMinor)}</td>
                    <td className="p-3">
                      <Badge tone={stateTone[o.state]}>{PAYMENT_STATE_LABELS[o.state]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="recent-payments">
        <h2 id="recent-payments" className="text-lg font-bold">
          Recorded payments
        </h2>
        {recent.length === 0 ? (
          <EmptyState>No payments recorded yet.</EmptyState>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Method</th>
                  <th className="p-3 font-medium">Reference / note</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0" data-testid="recorded-payment">
                    <td className="whitespace-nowrap p-3">{formatKarachiDate(p.receivedAt)}</td>
                    <td className="p-3 font-semibold">{p.orderNumber}</td>
                    <td className="whitespace-nowrap p-3">{formatPKR(p.amountMinor)}</td>
                    <td className="p-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td className="p-3 text-xs text-muted">{[p.reference, p.note].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="commission-payouts">
        <h2 id="commission-payouts" className="text-lg font-bold">
          Affiliate commission payouts
        </h2>
        <p className="mt-1 text-sm text-muted">
          Commission is paid through payout requests. To mark a payout as paid, use{" "}
          <Link href="/admin/affiliates/withdrawals" className="font-semibold text-brand">
            Affiliates → Withdrawals
          </Link>
          .
        </p>
        <FilterLinks base="/admin/payments" param="payout" current={payout ?? ""} options={[{ value: "PAID", label: "Paid" }, { value: "UNPAID", label: "Unpaid" }]} />
        {commissions.length === 0 ? (
          <EmptyState>No affiliate commissions here.</EmptyState>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Affiliate</th>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Commission</th>
                  <th className="p-3 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0" data-testid="commission-payout-row">
                    <td className="p-3">
                      {c.affiliate.user.name}
                      <span className="block font-mono text-xs text-muted">{c.affiliate.code}</span>
                    </td>
                    <td className="p-3">{c.order.number}</td>
                    <td className="whitespace-nowrap p-3 font-semibold">{formatPKR(c.amountMinor)}</td>
                    <td className="p-3 text-xs">
                      <Badge tone={c.paid ? "green" : "amber"}>{c.paid ? "Paid" : "Unpaid"}</Badge>
                      <span className="mt-1 block text-muted">
                        {c.paid
                          ? [c.paidAt && formatKarachiDate(c.paidAt), c.withdrawal?.transactionRef].filter(Boolean).join(" · ")
                          : c.status === "APPROVED"
                            ? "Approved, waiting for payout"
                            : "Pending (approved when the order is Fully Paid)"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
