import Link from "next/link";

// App mode only (hidden on the normal website): the compact top of the Home screen and the
// "how it works" steps as one sideways-swiping row.

/** Greeting, a search bar (searches the products) and a sideways row of service chips. */
export function AppHomeHeader({ chips }: { chips: { href: string; label: string }[] }) {
  return (
    <section className="hidden border-b border-border bg-surface px-4 pb-4 pt-4 app:block" aria-label="Start" data-testid="app-home-header">
      <p className="text-base text-muted">Assalam o Alaikum 👋</p>
      <p className="mt-0.5 text-[1.375rem] font-extrabold leading-tight tracking-tight">What would you like to print today?</p>
      <form action="/products" role="search" className="relative mt-4">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" />
        </svg>
        <input type="search" name="q" placeholder="Search products & services" aria-label="Search products and services" className="input rounded-full pl-11" maxLength={100} />
      </form>
      <nav className="app-scroll-row -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" aria-label="Services">
        {chips.map((c) => (
          <Link key={c.href} href={c.href} className="flex min-h-11 shrink-0 items-center rounded-full border border-border bg-background px-4 text-[0.9375rem] font-semibold hover:border-brand">
            {c.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

/** The four "how it works" steps as one row that swipes sideways. */
export function AppSteps({ steps }: { steps: string[][] }) {
  return (
    <section className="hidden px-4 pt-8 app:block" aria-labelledby="app-steps-heading" data-testid="app-steps">
      <h2 id="app-steps-heading" className="text-[1.375rem] font-bold">
        How it works
      </h2>
      <ol className="app-scroll-row -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {steps.map(([n, title, text]) => (
          <li key={n} className="card w-64 shrink-0 snap-start p-4">
            <span className="text-2xl font-black text-brand">{n}</span>
            <p className="mt-1 text-[1.0625rem] font-semibold">{title}</p>
            <p className="mt-1 text-[0.9375rem] text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
