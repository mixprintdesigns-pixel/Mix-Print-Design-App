import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <AccountOverview />
      </Suspense>
    </div>
  );
}

async function AccountOverview() {
  const user = await requireUser("/account");
  return (
    <>
      <h1 className="text-3xl font-bold">My account</h1>
      <p className="mt-1 text-muted">Signed in as {user.email}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          ["Orders", "Track orders, approve proofs and chat with our team.", "Coming in stage 2"],
          ["Design requests", "Brief our designers and review their proofs.", "Coming in stage 3"],

        ].map(([title, text, note]) => (
          <div key={title} className="card p-5">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{text}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent">{note}</p>
          </div>
        ))}
      </div>
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">Affiliate program</p>
          <p className="text-sm text-muted">Earn commission by referring customers to Mix Print Design.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/affiliate/dashboard" className="btn-secondary">
            Affiliate dashboard
          </Link>
          <Link href="/affiliate/join" className="btn-primary">
            Join
          </Link>
        </div>
      </div>
    </>
  );
}
