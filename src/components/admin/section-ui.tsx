import Link from "next/link";

// Small building blocks shared by the Design work, Customers, Payments and Reports pages.

/** Filter pills that link to the same page with ?<param>=<value>. */
export function FilterLinks({ base, param = "status", current, options }: { base: string; param?: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter">
      {[{ value: "", label: "All" }, ...options].map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value || "all"}
            href={o.value ? `${base}?${param}=${o.value}` : base}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

const TONES = {
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  grey: "bg-surface text-muted border border-border",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="card mt-4 p-8 text-center text-muted">{children}</p>;
}
