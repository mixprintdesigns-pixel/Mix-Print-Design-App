import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentCartCount } from "@/lib/cart/session";
import { logoutAction } from "@/app/actions/auth";
import { MobileMenu, type NavLink } from "@/components/mobile-menu";

// Site pages, shown in the header on large screens and in the menu on phones/tablets.
const PAGES: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/affiliate", label: "Earn with us" },
];
const SHORTCUTS: NavLink[] = [
  { href: "/products?category=business-cards", label: "Business cards" },
  { href: "/products?category=marketing", label: "Marketing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          Mix<span className="text-brand">Print</span>
        </Link>
        <nav className="hidden gap-5 text-sm font-medium text-muted lg:flex" aria-label="Main">
          {PAGES.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          {SHORTCUTS.map((l) => (
            <Link key={l.href} href={l.href} className="hidden hover:text-foreground xl:inline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <MobileMenu links={[...PAGES, ...SHORTCUTS]} />
          {/* Reads cookies, so it streams in after the static shell. */}
          <Suspense fallback={<span className="h-9 w-32" aria-hidden />}>
            <HeaderSession />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderSession() {
  const [user, cartCount] = await Promise.all([getCurrentUser(), getCurrentCartCount()]);
  return (
    <>
      {user ? (
        <>
          {(user.role === "ADMIN" || user.role === "STAFF") && (
            <Link href="/admin" className="font-medium text-accent hover:text-brand">
              Admin
            </Link>
          )}
          <Link href="/account" className="hidden font-medium hover:text-brand sm:inline">
            Hi, {user.name.split(" ")[0]}
          </Link>
          <form action={logoutAction}>
            <button className="text-muted hover:text-foreground">Sign out</button>
          </form>
        </>
      ) : (
        <Link href="/login" className="font-medium hover:text-brand">
          Sign in
        </Link>
      )}
      <Link href="/cart" className="btn-secondary py-2" aria-label={`Cart, ${cartCount} items`}>
        Cart
        <span
          data-testid="cart-count"
          className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white"
        >
          {cartCount}
        </span>
      </Link>
    </>
  );
}
