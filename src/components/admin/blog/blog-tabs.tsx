import Link from "next/link";

/** Articles / Categories tabs at the top of the Blog admin. */
export function BlogTabs({ current }: { current: "articles" | "categories" }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-brand text-white" : "border border-border bg-surface hover:border-brand"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="mt-3 flex gap-2" aria-label="Blog sections">
      {tab("/admin/blog", "Articles", current === "articles")}
      {tab("/admin/blog/categories", "Categories", current === "categories")}
    </nav>
  );
}
