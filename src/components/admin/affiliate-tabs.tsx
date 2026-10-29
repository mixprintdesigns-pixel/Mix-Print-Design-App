import Link from "next/link";

const tabs = [
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/affiliates/commissions", label: "Commissions" },
  { href: "/admin/affiliates/withdrawals", label: "Withdrawals" },
  { href: "/admin/affiliates/settings", label: "Program settings" },
];

export function AffiliateTabs({ current }: { current: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Affiliate sections">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${t.href === current ? "bg-brand text-white" : "hover:bg-surface"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const statusStyle: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  PAID: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  REVERSED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[status] ?? ""}`}>{status.toLowerCase()}</span>;
}

export function StatusFilter({ action, current, options }: { action: string; current: string; options: string[] }) {
  return (
    <form action={action} className="mt-4 flex gap-2">
      <select name="status" defaultValue={current} className="input w-auto" aria-label="Filter by status">
        <option value="">All statuses</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0) + o.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button className="btn-secondary">Filter</button>
    </form>
  );
}
