import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProgramTerms } from "@/lib/affiliate/public";
import { getAffiliateForUser } from "@/lib/affiliate/service";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";
import { pageMetadata } from "@/lib/content/seo-pages";

export const generateMetadata = () => pageMetadata("affiliate");

export default async function AffiliateLandingPage() {
  const terms = await getPublicProgramTerms();
  const rate = formatPercent(terms.defaultRateBps);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Mix Print Design affiliate program</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Earn <span className="text-brand">{rate} commission</span> on every order you refer.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Share your link on Instagram, Facebook, WhatsApp or your website. When someone orders sign boards, printing or
            customized gifts within {terms.cookieDays} days, on WhatsApp or in our chat, you earn. Many products pay a fixed amount
            in rupees, shown in your dashboard. Get paid to JazzCash, Easypaisa or your bank.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Suspense fallback={<Link href="/affiliate/join" className="btn-primary">Join Now</Link>}>
              <JoinButton />
            </Suspense>
            <Link href="/login?next=%2Faffiliate%2Fdashboard" className="btn-secondary">
              Login
            </Link>
            <a href="#how" className="btn-secondary">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Join", "Sign up free and verify your email and mobile. We review applications quickly."],
            ["Copy your link", "Your dashboard lists every product with what you earn and a Copy Link button."],
            ["Share", `Share on WhatsApp, Facebook, Instagram or TikTok. Visitors are remembered for ${terms.cookieDays} days.`],
            ["Earn commission", `When the customer has paid in full, your commission is approved. Withdraw from ${formatPKR(terms.minWithdrawalMinor)}.`],
          ].map(([title, text], i) => (
            <li key={title} className="card p-5">
              <span className="text-3xl font-black text-brand">{i + 1}</span>
              <p className="mt-1 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold">Program details</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              ["Commission", `A fixed amount per product (e.g. Rs 200), or ${rate} of product value`],
              ["Referral window", `${terms.cookieDays} days from the click (last click wins)`],
              ["When commission is approved", "After the customer's full payment (50% advance + 50% balance)"],
              ["Minimum withdrawal", formatPKR(terms.minWithdrawalMinor)],
              ["Payout methods", "JazzCash, Easypaisa, bank transfer (IBAN)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div id="terms" className="card p-6">
          <h2 className="text-xl font-bold">Affiliate terms</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Commission is earned on product value only; delivery charges and taxes are excluded.</li>
            <li>Commission is cancelled if the order is cancelled or refunded.</li>
            <li>You cannot earn commission on your own orders.</li>
            <li>No spam, misleading claims, or paid search ads bidding on the Mix Print Design name.</li>
            <li>Mix Print Design may suspend accounts that break these rules. Earned, valid commission is still paid.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

async function JoinButton() {
  const user = await getCurrentUser();
  const affiliate = user ? await getAffiliateForUser(user.id) : null;
  if (affiliate && affiliate.status !== "REJECTED") {
    return (
      <Link href="/affiliate/dashboard" className="btn-primary">
        Go to your affiliate dashboard
      </Link>
    );
  }
  return (
    <Link href="/affiliate/join" className="btn-primary">
      Join Now
    </Link>
  );
}
