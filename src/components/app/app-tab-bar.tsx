"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// App mode only (hidden on the normal website): the bottom tab bar and the full-screen "More" sheet.
// To add a page to the More sheet later, add one line to MORE_LINKS below.

type IconName = "home" | "services" | "products" | "earn" | "more" | "blog" | "about" | "contact" | "track" | "privacy" | "terms" | "close";

const PATHS: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  services: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  products: "M6 7h12l1 13H5zM9 7a3 3 0 0 1 6 0",
  earn: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3.1 4.5 1.4 4.5 3.2-2 3.2-4.5 3.2-4.5-1.4-4.5-3.2",
  more: "M5 7h14M5 12h14M5 17h14",
  blog: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6",
  about: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  contact: "M4 6h16v12H4zM4 7l8 6 8-6",
  track: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  privacy: "M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z",
  terms: "M7 3h10v18H7zM10 8h4M10 12h4M10 16h2",
  close: "M6 6l12 12M18 6 6 18",
};

export function AppIcon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

const TABS: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { href: "/services", label: "Services", icon: "services", match: (p) => p.startsWith("/services") },
  { href: "/products", label: "Products", icon: "products", match: (p) => p.startsWith("/products") || p.startsWith("/order") },
  { href: "/affiliate", label: "Earn", icon: "earn", match: (p) => p.startsWith("/affiliate") || p.startsWith("/r/") },
];

/** Pages in the More sheet (account and social links are added below them). */
export const MORE_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/blog", label: "Blog", icon: "blog" },
  { href: "/about", label: "About Us", icon: "about" },
  { href: "/contact", label: "Contact Us", icon: "contact" },
  { href: "/track", label: "Track your order", icon: "track" },
  { href: "/privacy-policy", label: "Privacy Policy", icon: "privacy" },
  { href: "/terms", label: "Terms & Conditions", icon: "terms" },
];

/** A row in the More sheet: icon, label, chevron. Used for the links here and for the account / social rows. */
export function MoreRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-h-14 items-center gap-4 px-4 py-3 text-base font-medium">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">{icon}</span>
      <span className="flex-1">{children}</span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </span>
  );
}

const MORE_PATHS = [...MORE_LINKS.map((l) => l.href), "/account", "/login", "/register", "/admin"];

export function AppTabBar({ account, social }: { account: ReactNode; social: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = MORE_PATHS.some((p) => pathname.startsWith(p));

  // Close the sheet when a page opens, and stop the page behind it from scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="hidden app:block" data-testid="app-nav">
      {open && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="More"
          data-testid="app-more"
          // Any link or form button inside closes the sheet.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a, button[type=submit]")) setOpen(false);
          }}
        >
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
            <p className="text-lg font-bold">More</p>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full hover:bg-background" aria-label="Close" onClick={() => setOpen(false)}>
              <AppIcon name="close" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ul className="mx-4 mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {MORE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block hover:bg-background" aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
                    <MoreRow icon={<AppIcon name={l.icon} />}>{l.label}</MoreRow>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mx-6 mt-6 text-xs font-bold uppercase tracking-widest text-muted">Your account</p>
            <ul className="mx-4 mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{account}</ul>
            <p className="mx-6 mt-6 text-xs font-bold uppercase tracking-widest text-muted">Contact &amp; social</p>
            <ul className="mx-4 mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{social}</ul>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="App"
      >
        <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active = !open && t.match(pathname);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-brand" : "text-muted"}`}
                >
                  <span className={`grid h-8 w-14 place-items-center rounded-full ${active ? "bg-brand/15" : ""}`}>
                    <AppIcon name={t.icon} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-current={open || moreActive ? "page" : undefined}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold ${open || moreActive ? "text-brand" : "text-muted"}`}
            >
              <span className={`grid h-8 w-14 place-items-center rounded-full ${open || moreActive ? "bg-brand/15" : ""}`}>
                <AppIcon name="more" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
