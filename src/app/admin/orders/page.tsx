import { recordOrderAction, updateOrderStatusAction } from "@/app/admin/order-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatPKR } from "@/lib/money";
import { listRecentOrders, ORDER_STATUSES } from "@/lib/orders/manual";

export const metadata = { title: "Orders" };

const label = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

export default async function AdminOrdersPage() {
  await requireStaff();
  const [orders, products] = await Promise.all([
    listRecentOrders(),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Orders</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Record each WhatsApp order here. If the customer came from an affiliate (their WhatsApp message shows &quot;Ref: CODE&quot;), enter the
        code: the affiliate&apos;s commission is added and approved after the order is delivered. Cancelled or refunded orders lose the commission.
      </p>

      <ActionForm action={recordOrderAction} className="card mt-6 space-y-4 p-5">
        <h2 className="text-lg font-bold">Record a WhatsApp order</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Customer name</span>
            <input name="customerName" className="input" maxLength={100} />
          </label>
          <label className="block">
            <span className="label">Phone / WhatsApp</span>
            <input name="customerPhone" className="input" maxLength={30} />
          </label>
          <label className="block">
            <span className="label">Affiliate code (optional)</span>
            <input name="referralCode" className="input uppercase" maxLength={20} placeholder="e.g. AB12CD34" />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Items (fill one row per item)</legend>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem_8rem]">
              <select name={`item${i}.productId`} className="input" aria-label={`Item ${i + 1} product`} defaultValue="">
                <option value="">Product (optional)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input name={`item${i}.description`} className="input" placeholder="Description" aria-label={`Item ${i + 1} description`} maxLength={200} />
              <input name={`item${i}.quantity`} className="input" inputMode="numeric" placeholder="Qty" aria-label={`Item ${i + 1} quantity`} />
              <input name={`item${i}.total`} className="input" inputMode="decimal" placeholder="Total (Rs)" aria-label={`Item ${i + 1} total`} />
            </div>
          ))}
        </fieldset>
        <label className="block">
          <span className="label">Notes (optional)</span>
          <textarea name="notes" rows={2} className="input" maxLength={1000} />
        </label>
        <SubmitButton className="btn-primary">Record order</SubmitButton>
      </ActionForm>

      <section className="mt-8" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="text-lg font-bold">
          Recent orders
        </h2>
        {orders.length === 0 ? (
          <p className="card mt-3 p-6 text-center text-muted">No orders yet.</p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Items</th>
                  <th className="p-3 font-medium">Total</th>
                  <th className="p-3 font-medium">Affiliate</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border align-top last:border-0" data-testid="admin-order">
                    <td className="p-3">
                      <span className="font-semibold">{o.number}</span>
                      <span className="block text-xs text-muted">
                        {o.source === "WHATSAPP" ? "WhatsApp" : "Website"} · {o.placedAt.toLocaleDateString("en-PK")}
                      </span>
                    </td>
                    <td className="p-3">
                      {o.customerName ?? o.user?.name ?? "—"}
                      {o.customerPhone && <span className="block text-xs text-muted">{o.customerPhone}</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {o.items.map((i, n) => (
                        <span key={n} className="block">
                          {i.quantity} × {i.productName}
                        </span>
                      ))}
                    </td>
                    <td className="p-3 font-semibold">{formatPKR(o.totalMinor)}</td>
                    <td className="p-3 text-xs">
                      {o.affiliate ? (
                        <>
                          {o.affiliate.code}
                          {o.commission && (
                            <span className="block text-muted">
                              {formatPKR(o.commission.amountMinor)} · {label(o.commission.status)}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <ActionForm action={updateOrderStatusAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <select name="status" defaultValue={o.status} className="input w-auto py-1.5 text-xs" aria-label={`Status of ${o.number}`}>
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                        <SubmitButton>Update</SubmitButton>
                      </ActionForm>
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
