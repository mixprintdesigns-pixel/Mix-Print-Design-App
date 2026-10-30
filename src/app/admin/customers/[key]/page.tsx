import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCustomerNoteAction } from "@/app/admin/sections-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Badge, EmptyState, StatTile } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import { getCustomer } from "@/lib/admin-sections/customers";
import { paymentState, PAYMENT_STATE_LABELS } from "@/lib/admin-sections/payments";
import { formatKarachiDate } from "@/lib/admin-sections/shared";
import { formatPKR } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/orders/manual";

export const metadata = { title: "Customer" };

const stateTone = { PAID: "green", PARTIAL: "amber", UNPAID: "red" } as const;

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[key]">) {
  await requireStaff();
  const key = decodeURIComponent((await params).key);
  const customer = await getCustomer(key);
  if (!customer) notFound();
  const whatsapp = customer.phone?.replace(/\D/g, "").replace(/^0/, "92");

  return (
    <>
      <Link href="/admin/customers" className="text-sm text-muted hover:text-foreground">
        ← Customers
      </Link>
      <h1 className="mt-1 text-2xl font-bold">{customer.name}</h1>
      <p className="text-sm text-muted">{customer.hasAccount ? "Registered customer" : "Customer from WhatsApp / chat orders"}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="font-bold">
            Contact
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted">Phone</dt>
              <dd>
                {customer.phone ?? "—"}
                {whatsapp && (
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-semibold text-green-700 dark:text-green-400">
                    WhatsApp ↗
                  </a>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{customer.email ? <a href={`mailto:${customer.email}`} className="text-brand">{customer.email}</a> : "—"}</dd>
            </div>
          </dl>
        </section>
        <section className="card p-5" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="font-bold">
            Internal notes
          </h2>
          <p className="text-xs text-muted">Only staff can see these.{customer.noteUpdatedAt && ` Last saved ${formatKarachiDate(customer.noteUpdatedAt, true)}.`}</p>
          <ActionForm action={saveCustomerNoteAction} className="mt-3 space-y-2">
            <input type="hidden" name="customerKey" value={customer.key} />
            <textarea name="note" rows={4} defaultValue={customer.note} maxLength={5000} className="input" aria-label="Internal notes" placeholder="e.g. Prefers matte finish. Pays by JazzCash." />
            <SubmitButton className="btn-primary px-3 py-1.5 text-sm">Save notes</SubmitButton>
          </ActionForm>
        </section>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="Orders" value={String(customer.orderCount)} />
        <StatTile label="Total spent (paid)" value={formatPKR(customer.totalPaidMinor)} />
        <StatTile label="Total ordered" value={formatPKR(customer.totalOrderedMinor)} hint="Cancelled and refunded orders are not counted." />
      </div>

      <h2 className="mt-8 text-lg font-bold">All orders</h2>
      {customer.orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Order</th>
                <th className="p-3 font-medium">Items</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((o) => {
                const state = paymentState(o.totalMinor, o.receivedMinor);
                return (
                  <tr key={o.id} className="border-b border-border align-top last:border-0">
                    <td className="p-3">
                      <span className="font-semibold">{o.number}</span>
                      <span className="block text-xs text-muted">{formatKarachiDate(o.placedAt)}</span>
                    </td>
                    <td className="p-3 text-xs">
                      {o.items.map((i, n) => (
                        <span key={n} className="block">
                          {i.quantity} × {i.productName}
                        </span>
                      ))}
                    </td>
                    <td className="p-3 text-xs">{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] ?? o.status}</td>
                    <td className="whitespace-nowrap p-3">{formatPKR(o.totalMinor)}</td>
                    <td className="whitespace-nowrap p-3 text-xs">
                      <Badge tone={stateTone[state]}>{PAYMENT_STATE_LABELS[state]}</Badge>
                      <span className="mt-1 block">Paid {formatPKR(o.receivedMinor)}</span>
                      {o.balanceMinor > 0 && <span className="block text-amber-700 dark:text-amber-400">Balance {formatPKR(o.balanceMinor)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
