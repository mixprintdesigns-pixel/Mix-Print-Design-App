import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/legal-page";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Terms & Conditions | Mix Print Design",
  description: "Simple terms for orders, payment, delivery and the affiliate program at Mix Print Design, Lahore.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" path="/terms" updated="3 November 2026">
      <section>
        <p>These simple terms apply when you order from Mix Print Design through our website, app, WhatsApp or phone.</p>
      </section>

      <section aria-labelledby="orders">
        <h2 id="orders">Orders and artwork</h2>
        <ul>
          <li>Prices on the website are a guide; we confirm the final price, artwork and delivery date with you before work starts.</li>
          <li>For printed items we send you a design proof. Please check spelling, numbers and colours carefully: we print what you approve.</li>
          <li>You must own, or have permission to use, the logos, photos and text you send us.</li>
          <li>Colours can look slightly different on screen and on paper or boards.</li>
        </ul>
      </section>

      <section aria-labelledby="payment">
        <h2 id="payment">Payment</h2>
        <ul>
          <li>50% advance before work starts, and the remaining 50% after the work is complete, before delivery.</li>
          <li>We accept JazzCash, Easypaisa, bank transfer and cash.</li>
          <li>Work is delivered only after full payment.</li>
        </ul>
      </section>

      <section aria-labelledby="delivery">
        <h2 id="delivery">Delivery</h2>
        <ul>
          <li>You can collect your order from Raiwind Road, Lahore, or we deliver across Pakistan. Delivery charges are confirmed with your order.</li>
          <li>Production times are estimates and start after proof approval and advance payment.</li>
          <li>Sign board installation is arranged separately where offered.</li>
        </ul>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes, cancellations and reprints</h2>
        <ul>
          <li>You can change or cancel an order free of charge before work starts.</li>
          <li>Once printing or fabrication has started, the advance cannot be refunded because the work is made specially for you.</li>
          <li>If a mistake is ours, we will reprint or fix it at no cost. Please tell us within 3 days of receiving your order.</li>
        </ul>
      </section>

      <section aria-labelledby="affiliate">
        <h2 id="affiliate">Affiliate program</h2>
        <ul>
          <li>Affiliates earn the commission shown for each product on orders placed through their link.</li>
          <li>Commission is approved only after the customer has paid in full; cancelled or refunded orders earn nothing.</li>
          <li>No spam, no misleading claims and no self-referrals. We may suspend accounts that break these rules.</li>
          <li>
            Payouts are sent to JazzCash, Easypaisa or bank. Full details:{" "}
            <Link href="/affiliate#terms" className="font-semibold text-brand">
              affiliate program terms
            </Link>
            .
          </li>
        </ul>
      </section>

      <section aria-labelledby="general">
        <h2 id="general">General</h2>
        <p>
          These terms follow the laws of Pakistan. We may update them; the date above shows the latest version. Questions? Email{" "}
          <a href={`mailto:${CONTACT.email}`} className="font-semibold text-brand">
            {CONTACT.email}
          </a>{" "}
          or call / WhatsApp{" "}
          <a href={`tel:${CONTACT.tel}`} className="font-semibold text-brand">
            {CONTACT.phone}
          </a>
          . See also our{" "}
          <Link href="/privacy-policy" className="font-semibold text-brand">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
