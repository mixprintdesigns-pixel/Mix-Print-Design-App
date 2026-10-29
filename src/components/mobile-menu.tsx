"use client";

import Link from "next/link";
import { useState } from "react";

export type NavLink = { href: string; label: string };

/** Menu button and drop-down panel for phones and tablets (hidden on large screens). */
export function MobileMenu({ links }: { links: NavLink[] }) {
  // The header is part of every page's static shell, so this avoids reading the URL;
  // the menu closes when a link is chosen.
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-16 border-b border-border bg-surface shadow-lg">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 font-medium hover:bg-background" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
