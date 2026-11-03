import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/legal-page";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Privacy Policy | Mix Print Design",
  description: "How Mix Print Design collects, uses and protects your information on our website and Android app.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" path="/privacy-policy" updated="3 November 2026">
      <section>
        <p>
          This policy explains what information Mix Print Design (&quot;we&quot;) collects when you use our website and our Android app, why we
          collect it, and how we keep it safe. The app shows the same website, so this policy covers both.
        </p>
      </section>

      <section aria-labelledby="collect">
        <h2 id="collect">What we collect</h2>
        <ul>
          <li>
            <strong>Contact details:</strong> your name, mobile / WhatsApp number, email address and delivery address.
          </li>
          <li>
            <strong>Order details:</strong> the products, options, quantities, prices, notes, artwork and photos of finished work for your orders, and
            payments received.
          </li>
          <li>
            <strong>Account details:</strong> if you create an account, your login email and password (stored only in scrambled, encrypted form).
          </li>
          <li>
            <strong>Affiliate details:</strong> if you join our affiliate program, your payout details (JazzCash, Easypaisa or bank account number and
            account title), the visits and orders from your referral link, and your commissions.
          </li>
          <li>
            <strong>Messages:</strong> what you send us through the contact form or the chat on our website.
          </li>
          <li>
            <strong>Cookies:</strong> small files that keep you signed in and remember an affiliate&apos;s referral code for up to 30 days. We do not use
            advertising cookies.
          </li>
        </ul>
      </section>

      <section aria-labelledby="why">
        <h2 id="why">Why we use it</h2>
        <ul>
          <li>To prepare, print and deliver your orders, send you design proofs, and contact you about your order on WhatsApp, phone or email.</li>
          <li>To confirm payments and keep records required for our business.</li>
          <li>To run the affiliate program: track referred orders and pay commissions.</li>
          <li>To answer your questions and improve our website and service.</li>
        </ul>
      </section>

      <section aria-labelledby="store">
        <h2 id="store">How it is stored and protected</h2>
        <ul>
          <li>Our website runs on Vercel, and your information is stored in a secure Neon database. Uploaded files are kept in Vercel storage.</li>
          <li>Emails (such as verification codes and order updates) are sent through Resend.</li>
          <li>Answers in our website chat may be prepared by an AI service using our product information; please do not share sensitive details in the chat.</li>
          <li>All connections to our website are encrypted (https). Only our team can see order and customer details in our admin panel.</li>
          <li>We keep information only as long as needed for orders, accounting and the affiliate program.</li>
        </ul>
      </section>

      <section aria-labelledby="share">
        <h2 id="share">We never sell your data</h2>
        <p>
          We do not sell, rent or trade your personal information. We share it only with the services listed above, which work for us, or when the law
          requires it. Delivery companies receive only what they need to deliver your order.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Your choices</h2>
        <p>
          You can ask us to see, correct or delete your information at any time. Some order and payment records may need to be kept for accounting.
          Email or WhatsApp us and we will help you.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Contact us</h2>
        <p>
          Mix Print Design, {CONTACT.address}
          <br />
          Email:{" "}
          <a href={`mailto:${CONTACT.email}`} className="font-semibold text-brand">
            {CONTACT.email}
          </a>
          <br />
          Phone / WhatsApp:{" "}
          <a href={`tel:${CONTACT.tel}`} className="font-semibold text-brand">
            {CONTACT.phone}
          </a>
        </p>
        <p>
          See also our{" "}
          <Link href="/terms" className="font-semibold text-brand">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
