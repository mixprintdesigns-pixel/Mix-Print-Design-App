import Link from "next/link";
import { EmptyState } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import { listCustomers } from "@/lib/admin-sections/customers";
import { formatKarachiDate } from "@/lib/admin-sections/shared";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireStaff();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.slice(0, 100) : "";
  const customers = await listCustomers(q);

  return (
    <>
      <h1 className="text-2xl font-bold">Customers</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Everyone who has an account or has ordered (website, WhatsApp or AI chat). Orders without an account are grouped by phone number.
      </p>

      <form action="/admin/customers" className="card mt-6 flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="block flex-1">
          <span className="label">Search by name, phone or email</span>
          <input name="q" defaultValue={q} className="input" placeholder="e.g. Bilal, 0300 1234567 or name@gmail.com" maxLength={100} />
        </label>
        <button className="btn-primary">Search</button>
        {q && (
          <Link href="/admin/customers" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-muted">
        {customers.length} customer{customers.length === 1 ? "" : "s"}
        {q && <> matching &quot;{q}&quot;</>}
      </p>
      {customers.length === 0 ? (
        <EmptyState>No customers found.</EmptyState>
      ) : (
        <div className="card mt-2 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Orders</th>
                <th className="p-3 font-medium">Total spent</th>
                <th className="p-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.key} className="border-b border-border last:border-0" data-testid="customer-row">
                  <td className="p-3">
                    <Link href={`/admin/customers/${encodeURIComponent(c.key)}`} className="font-semibold text-brand hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted">{c.hasAccount ? "Has an account" : "WhatsApp / chat orders"}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {c.phone && <span className="block">{c.phone}</span>}
                    {c.email && <span className="block text-muted">{c.email}</span>}
                    {!c.phone && !c.email && "—"}
                  </td>
                  <td className="p-3">{c.orderCount}</td>
                  <td className="whitespace-nowrap p-3">
                    <span className="font-semibold">{formatPKR(c.totalPaidMinor)}</span>
                    <span className="block text-xs text-muted">of {formatPKR(c.totalOrderedMinor)} ordered</span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs">{c.lastOrderAt ? formatKarachiDate(c.lastOrderAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
