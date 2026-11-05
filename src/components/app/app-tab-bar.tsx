"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

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

/**
 * Whether the More sheet is open. Kept outside the component: the bar is first shown as a placeholder while the
 * page loads and then replaced, and a tap on More in that moment must not be lost.
 */
const moreSheet = (() => {
  let open = false;
  const listeners = new Set<() => void>();
  return {
    get: () => open,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (next: boolean | ((o: boolean) => boolean)) => {
      open = typeof next === "function" ? next(open) : next;
      listeners.forEach((fn) => fn());
    },
  };
})();

type TabBarProps = { account: ReactNode; social: ReactNode };

export function AppTabBar(props: TabBarProps) {
  return <TabBar pathname={usePathname()} {...props} />;
}

/** Shown while the page address streams in, so the tab bar is on screen from the very first paint. */
export function AppTabBarFallback() {
  return <TabBar pathname="" account={null} social={null} />;
}

function TabBar({ pathname, account, social }: TabBarProps & { pathname: string }) {
  const open = useSyncExternalStore(moreSheet.subscribe, moreSheet.get, () => false);
  const setOpen = moreSheet.set;
  const moreActive = pathname !== "" && MORE_PATHS.some((p) => pathname.startsWith(p));

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
    <div className="hidden app:block!" data-testid="app-nav">
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-surface shadow-[0_-4px_20px_rgb(0_0_0/0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="App"
      >
        <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active = !open && t.match(pathname);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <span className={pillClass(active)}>
                    <TabIcon name={t.icon as TabIconName} filled={active} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-current={open || moreActive ? "page" : undefined} className={`w-full ${tabClass(open || moreActive)}`}>
              <span className={pillClass(open || moreActive)}>
                <TabIcon name="more" filled={open || moreActive} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

// ─── Bottom bar icons: outlined, and filled when the tab is open ──────────────

const tabClass = (active: boolean) =>
  `flex h-full flex-col items-center justify-center gap-0.5 text-[13px] font-semibold leading-tight ${active ? "text-brand" : "text-stone-500 dark:text-stone-400"}`;
const pillClass = (active: boolean) => `grid h-9 w-16 place-items-center rounded-full transition-colors ${active ? "bg-brand/15" : ""}`;

type TabIconName = "home" | "services" | "products" | "earn" | "more";

/** 28px tab icons: an outline, and a filled version for the open tab. */
function TabIcon({ name, filled }: { name: TabIconName; filled: boolean }) {
  const hole = { fill: "var(--surface)" };
  const common = { viewBox: "0 0 24 24", className: "h-7 w-7", "aria-hidden": true } as const;
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "home":
      return filled ? (
        <svg {...common} fill="currentColor">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="M10 21v-5.5h4V21z" style={hole} />
        </svg>
      ) : (
        <svg {...common} {...line}>
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "services":
      return (
        <svg {...common} {...(filled ? { fill: "currentColor" } : line)}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="2" />
        </svg>
      );
    case "products":
      return filled ? (
        <svg {...common}>
          <path d="M5 8h14l1.2 12.2a1 1 0 0 1-1 1.1H4.8a1 1 0 0 1-1-1.1z" fill="currentColor" />
          <path d="M9 8V7a3 3 0 0 1 6 0v1" {...line} />
        </svg>
      ) : (
        <svg {...common} {...line}>
          <path d="M5 8h14l1.2 12.2a1 1 0 0 1-1 1.1H4.8a1 1 0 0 1-1-1.1zM9 8V7a3 3 0 0 1 6 0v1" />
        </svg>
      );
    case "earn":
      return filled ? (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill="currentColor" />
          <path d="M12 6.5v11M14.8 9c0-1-1.2-1.8-2.8-1.8S9.2 8 9.2 9s1.2 1.6 2.8 1.9 2.8.9 2.8 1.9-1.2 1.9-2.8 1.9-2.8-.8-2.8-1.9" fill="none" strokeWidth={1.9} strokeLinecap="round" style={{ stroke: "var(--surface)" }} />
        </svg>
      ) : (
        <svg {...common} {...line}>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 6.5v11M14.8 9c0-1-1.2-1.8-2.8-1.8S9.2 8 9.2 9s1.2 1.6 2.8 1.9 2.8.9 2.8 1.9-1.2 1.9-2.8 1.9-2.8-.8-2.8-1.9" />
        </svg>
      );
    case "more":
      return (
        <svg {...common} {...(filled ? { fill: "currentColor" } : line)}>
          <circle cx="5" cy="12" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="19" cy="12" r="2.2" />
        </svg>
      );
  }
}
