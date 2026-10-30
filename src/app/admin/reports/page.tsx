import { EmptyState, FilterLinks, StatTile } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import { monthLabel, salesByDay, salesByMonth, topAffiliates, topProducts, unpaidBalances, type SalesRow } from "@/lib/admin-sections/reports";
import { formatKarachiDate } from "@/lib/admin-sections/shared";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireStaff();
  const view = (await searchParams).view === "month" ? "month" : "day";
  const [sales, products, affiliates, unpaid] = await Promise.all([
    view === "month" ? salesByMonth(12) : salesByDay(30),
    topProducts(10),
    topAffiliates(10),
    unpaidBalances(),
  ]);
  const totalSales = sales.reduce((s, r) => s + r.salesMinor, 0);
  const totalOrders = sales.reduce((s, r) => s + r.orders, 0);
  const totalUnpaid = unpaid.reduce((s, r) => s + r.balanceMinor, 0);

  return (
    <>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-muted">All amounts in PKR. Dates are Pakistan time (Asia/Karachi). Cancelled and refunded orders are not counted.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label={view === "month" ? "Sales, last 12 months" : "Sales, last 30 days"} value={formatPKR(totalSales)} hint={`${totalOrders} orders`} />
        <StatTile label="Average order" value={formatPKR(totalOrders ? Math.round(totalSales / totalOrders) : 0)} />
        <StatTile label="Unpaid balances" value={formatPKR(totalUnpaid)} hint={`${unpaid.length} orders`} />
      </div>

      <section className="mt-8" aria-labelledby="sales-heading">
        <h2 id="sales-heading" className="text-lg font-bold">
          Sales by {view}
        </h2>
        <FilterLinks base="/admin/reports" param="view" current={view === "month" ? "month" : ""} options={[{ value: "month", label: "By month" }]} />
        <SalesChart rows={sales} view={view} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="products-heading">
          <h2 id="products-heading" className="text-lg font-bold">
            Top products
          </h2>
          {products.length === 0 ? (
            <EmptyState>No sales yet.</EmptyState>
          ) : (
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 text-right font-medium">Qty</th>
                    <th className="p-3 text-right font-medium">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0" data-testid="top-product">
                      <td className="p-3">
                        {p.name}
                        <span className="block text-xs text-muted">
                          {p.orders} order{p.orders === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="p-3 text-right">{p.quantity.toLocaleString("en-PK")}</td>
                      <td className="whitespace-nowrap p-3 text-right font-semibold">{formatPKR(p.salesMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="affiliates-heading">
          <h2 id="affiliates-heading" className="text-lg font-bold">
            Top affiliates
          </h2>
          {affiliates.length === 0 ? (
            <EmptyState>No affiliate sales yet.</EmptyState>
          ) : (
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3 font-medium">Affiliate</th>
                    <th className="p-3 text-right font-medium">Orders</th>
                    <th className="p-3 text-right font-medium">Sales</th>
                    <th className="p-3 text-right font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map((a) => (
                    <tr key={a.code} className="border-b border-border last:border-0" data-testid="top-affiliate">
                      <td className="p-3">
                        {a.name}
                        <span className="block font-mono text-xs text-muted">{a.code}</span>
                      </td>
                      <td className="p-3 text-right">{a.orders}</td>
                      <td className="whitespace-nowrap p-3 text-right">{formatPKR(a.salesMinor)}</td>
                      <td className="whitespace-nowrap p-3 text-right font-semibold">{formatPKR(a.commissionMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="unpaid-heading">
        <h2 id="unpaid-heading" className="text-lg font-bold">
          Unpaid balances
        </h2>
        {unpaid.length === 0 ? (
          <EmptyState>Every order is fully paid.</EmptyState>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 text-right font-medium">Total</th>
                  <th className="p-3 text-right font-medium">Received</th>
                  <th className="p-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0" data-testid="unpaid-row">
                    <td className="p-3">
                      <span className="font-semibold">{o.number}</span>
                      <span className="block text-xs text-muted">{formatKarachiDate(o.placedAt)}</span>
                    </td>
                    <td className="p-3">
                      {o.customer}
                      {o.customerPhone && <span className="block text-xs text-muted">{o.customerPhone}</span>}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">{formatPKR(o.totalMinor)}</td>
                    <td className="whitespace-nowrap p-3 text-right">{formatPKR(o.receivedMinor)}</td>
                    <td className="whitespace-nowrap p-3 text-right font-semibold text-amber-700 dark:text-amber-400">{formatPKR(o.balanceMinor)}</td>
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

/** Bar chart in plain HTML: one bar per day or month, with the exact figures in a table for screen readers. */
function SalesChart({ rows, view }: { rows: SalesRow[]; view: "day" | "month" }) {
  const max = Math.max(1, ...rows.map((r) => r.salesMinor));
  const label = (r: SalesRow) => (view === "month" ? monthLabel(r.period) : formatKarachiDate(new Date(`${r.period}T12:00:00+05:00`)));
  return (
    <div className="card mt-3 p-5">
      <div className="flex h-48 items-end gap-1" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.period} className="group relative flex h-full flex-1 flex-col justify-end" title={`${label(r)}: ${formatPKR(r.salesMinor)} · ${r.orders} orders`}>
            <div className="rounded-t bg-brand transition group-hover:opacity-80" style={{ height: `${Math.max(r.salesMinor ? 2 : 0, (r.salesMinor / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{label(rows[0])}</span>
        <span>{label(rows[rows.length - 1])}</span>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Show figures</summary>
        <table className="mt-2 w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="p-2 font-medium">{view === "month" ? "Month" : "Date"}</th>
              <th className="p-2 text-right font-medium">Orders</th>
              <th className="p-2 text-right font-medium">Sales</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.period} className="border-b border-border last:border-0" data-testid="sales-row">
                <td className="p-2">{label(r)}</td>
                <td className="p-2 text-right">{r.orders}</td>
                <td className="whitespace-nowrap p-2 text-right">{formatPKR(r.salesMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
