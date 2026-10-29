import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyField, LinkBuilder, PayoutForm, WithdrawButton } from "@/components/affiliate/dashboard-widgets";
import { requireUser } from "@/lib/auth/session";
import { listProducts } from "@/lib/catalog/queries";
import {
  getAffiliateForUser,
  getAffiliateSettings,
  getAffiliateStats,
  listAffiliateCommissions,
  listAffiliateWithdrawals,
} from "@/lib/affiliate/service";
import { PAYOUT_LABEL } from "@/lib/affiliate/validation";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Affiliate dashboard", robots: { index: false } };

export default function AffiliateDashboardPage({ searchParams }: PageProps<"/affiliate/dashboard">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const commissionStyle: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  PAID: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  REVERSED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function Badge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${commissionStyle[status] ?? ""}`}>{status.toLowerCase()}</span>;
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/affiliate/dashboard">["searchParams"] }) {
  const user = await requireUser("/affiliate/dashboard");
  const affiliate = await getAffiliateForUser(user.id);
  if (!affiliate || affiliate.status === "REJECTED") redirect("/affiliate/join");

  const [query, stats, commissions, withdrawals, settings, siteUrl, products] = await Promise.all([
    searchParams,
    getAffiliateStats(affiliate.id),
    listAffiliateCommissions(affiliate.id),
    listAffiliateWithdrawals(affiliate.id),
    getAffiliateSettings(),
    getSiteUrl(),
    listProducts({ sort: "name" }),
  ]);
  const link = `${siteUrl}/r/${affiliate.code}`;
  const rate = formatPercent(affiliate.commissionRateBps ?? settings.defaultRateBps);
  const hasOpenWithdrawal = withdrawals.some((w) => w.status === "REQUESTED");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Affiliate dashboard</p>
          <h1 className="text-3xl font-bold">Welcome, {user.name.split(" ")[0]}</h1>
        </div>
        <p className="text-sm text-muted">
          Your code <span className="font-mono font-semibold text-foreground">{affiliate.code}</span> · {rate} commission
        </p>
      </div>

      {query.joined && affiliate.status === "PENDING" && (
        <p className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
          Thanks for applying! We will review your application shortly.
        </p>
      )}
      {affiliate.status === "PENDING" && (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="affiliate-status">
          Your application is under review. Your referral link will start earning once it is approved.
        </p>
      )}
      {affiliate.status === "SUSPENDED" && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300" data-testid="affiliate-status">
          Your affiliate account is suspended{affiliate.adminNote ? `: ${affiliate.adminNote}` : "."} Your links do not earn new
          commission, but you can still withdraw your available balance.
        </p>
      )}

      {affiliate.status === "APPROVED" && (
        <section className="card mt-6 grid gap-6 p-5 lg:grid-cols-2">
          <CopyField label="Your referral link" value={link} testId="referral-link" />
          <LinkBuilder baseLink={link} products={products.map((p) => ({ slug: p.slug, name: p.name }))} />
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your numbers">
        {[
          ["Clicks (30 days)", stats.clicks30.toLocaleString(), `${stats.clicks.toLocaleString()} all time`],
          ["Referred orders", stats.orders.toLocaleString(), `${(stats.conversionRate * 100).toFixed(1)}% of clicks`],
          ["Referred sales", formatPKR(stats.salesMinor), "product value"],
          ["Total earned", formatPKR(stats.pendingMinor + stats.availableMinor + stats.processingMinor + stats.paidMinor), `${formatPKR(stats.paidMinor)} paid`],
        ].map(([label, value, note]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold" data-testid={`stat-${label}`}>
              {value}
            </p>
            <p className="text-xs text-muted">{note}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-1">
          <h2 className="text-lg font-bold">Balance</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Pending (order not yet confirmed)</dt>
              <dd>{formatPKR(stats.pendingMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Withdrawal in progress</dt>
              <dd>{formatPKR(stats.processingMinor)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <dt className="font-semibold">Available</dt>
              <dd className="font-bold" data-testid="available-balance">
                {formatPKR(stats.availableMinor)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Minimum withdrawal {formatPKR(settings.minWithdrawalMinor)}. Commission is confirmed {settings.holdDays} days after
            delivery.
          </p>
          <div className="mt-4">
            <WithdrawButton disabled={hasOpenWithdrawal || stats.availableMinor < Math.max(settings.minWithdrawalMinor, 1)} />
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">Payout details</h2>
          <p className="mb-4 text-sm text-muted">
            {affiliate.payoutMethod
              ? `Currently: ${PAYOUT_LABEL[affiliate.payoutMethod]} · ${affiliate.payoutAccount}`
              : "Add where we should send your earnings."}
          </p>
          <PayoutForm
            defaults={{
              payoutMethod: affiliate.payoutMethod,
              payoutAccount: affiliate.payoutAccount,
              payoutAccountName: affiliate.payoutAccountName,
            }}
          />
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Commissions</h2>
        {commissions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No referred orders yet. Share your link to start earning.{" "}
            <Link href="/affiliate#how" className="font-semibold text-brand">
              Tips
            </Link>
          </p>
        ) : (
          <table className="mt-3 w-full min-w-[34rem] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Order</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Order value</th>
                <th className="py-2 font-medium">Commission</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2 font-mono">{c.order.number}</td>
                  <td className="py-2">{c.createdAt.toLocaleDateString("en-PK")}</td>
                  <td className="py-2">{formatPKR(c.baseAmountMinor)}</td>
                  <td className="py-2 font-semibold">{formatPKR(c.amountMinor)}</td>
                  <td className="py-2">
                    <Badge status={c.status} />
                    {c.note && <span className="ml-2 text-xs text-muted">{c.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Withdrawals</h2>
        {withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No withdrawals yet.</p>
        ) : (
          <table className="mt-3 w-full min-w-[34rem] text-sm" data-testid="withdrawals">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Requested</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Paid to</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="py-2">{w.requestedAt.toLocaleDateString("en-PK")}</td>
                  <td className="py-2 font-semibold">{formatPKR(w.amountMinor)}</td>
                  <td className="py-2">
                    {PAYOUT_LABEL[w.method]} · {w.account}
                  </td>
                  <td className="py-2">
                    <Badge status={w.status} />
                    {w.transactionRef && <span className="ml-2 text-xs text-muted">Ref {w.transactionRef}</span>}
                    {w.adminNote && <span className="ml-2 text-xs text-muted">{w.adminNote}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
