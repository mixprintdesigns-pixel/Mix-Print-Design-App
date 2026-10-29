import Link from "next/link";
import { getDashboardCounts } from "@/lib/admin/catalog-service";

export default async function AdminDashboard() {
  const counts = await getDashboardCounts();
  const tiles = [
    { label: "Published products", value: counts.published, href: "/admin/products?status=PUBLISHED" },
    { label: "Draft products", value: counts.drafts, href: "/admin/products?status=DRAFT" },
    { label: "Published but unavailable", value: counts.unavailable, href: "/admin/products?status=PUBLISHED" },
    { label: "Categories", value: counts.categories, href: "/admin/categories" },
    { label: "Customers", value: counts.customers, href: null },
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-sm text-muted">{t.label}</p>
              <p className="mt-1 text-3xl font-bold">{t.value}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="card p-5 hover:border-brand">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="card p-5">
              {body}
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/products/new" className="btn-primary">
          Add product
        </Link>
        <Link href="/admin/categories" className="btn-secondary">
          Manage categories
        </Link>
      </div>
    </>
  );
}
