import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandBadge } from "@/components/brand-logo";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Mix Print Design Admin" }, robots: { index: false } };

const sections: { href: string; label: string; ready: boolean }[] = [
  { href: "/admin", label: "Dashboard", ready: true },
  { href: "/admin/products", label: "Products", ready: true },
  { href: "/admin/categories", label: "Categories & Services", ready: true },
  { href: "/admin/reviews", label: "Reviews", ready: true },
  { href: "/admin/about", label: "About page", ready: true },
  { href: "/admin/seo", label: "SEO", ready: true },
  { href: "/admin/settings", label: "Contact & social", ready: true },
  { href: "/admin/messages", label: "Contact messages", ready: true },
  { href: "/admin/orders", label: "Orders", ready: true },
  { href: "/admin/designs", label: "Design work", ready: true },
  { href: "/admin/customers", label: "Customers", ready: true },
  { href: "/admin/payments", label: "Payments", ready: true },
  { href: "/admin/affiliates", label: "Affiliates & commissions", ready: true },
  { href: "/admin/reports", label: "Reports", ready: true },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[13rem_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-24 lg:self-start">
        <BrandBadge className="mb-3 h-12 w-12" />
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">Admin</p>
        <ul className="flex gap-1 overflow-x-auto text-sm lg:flex-col">
          {sections.map((s) => (
            <li key={s.href} className="shrink-0">
              {s.ready ? (
                <Link href={s.href} className="block rounded-lg px-3 py-2 font-medium hover:bg-surface">
                  {s.label}
                </Link>
              ) : (
                <span className="block cursor-not-allowed rounded-lg px-3 py-2 text-muted" title="Built in a later stage">
                  {s.label} <span className="text-xs">(soon)</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        {/* The role check reads the session cookie, so it streams in behind this boundary. */}
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <StaffOnly>{children}</StaffOnly>
        </Suspense>
      </div>
    </div>
  );
}

async function StaffOnly({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
