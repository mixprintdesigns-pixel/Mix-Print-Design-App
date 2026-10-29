import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { BUSINESS, MAP_EMBED_URL, whatsappLink } from "@/lib/business";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Contact Mix Print Design on Raiwind Road, Lahore. Call or WhatsApp ${BUSINESS.phoneDisplay}.`,
};

const details = [
  { label: "Phone", value: BUSINESS.phoneDisplay, href: `tel:${BUSINESS.phoneTel}` },
  { label: "WhatsApp", value: BUSINESS.phoneDisplay, href: whatsappLink("Assalam o Alaikum! I have a printing enquiry."), external: true },
  { label: "Email", value: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
  { label: "Facebook", value: "facebook.com/mixprintdesign", href: BUSINESS.facebookUrl, external: true },
  { label: "Address", value: BUSINESS.address },
];

export default function ContactPage({ searchParams }: PageProps<"/contact">) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Contact us</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Let&apos;s talk about your print job.</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">Send us a message, call, or chat on WhatsApp. We are happy to quote any size of order.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[3fr_2fr]">
        <section className="card p-6" aria-labelledby="form-heading">
          <h2 id="form-heading" className="text-xl font-bold">
            Send a message
          </h2>
          <div className="mt-4">
            {/* The subject can be pre-filled from "Get Quote" buttons (?subject=…), a request-time value. */}
            <Suspense fallback={<ContactForm />}>
              <PrefilledForm searchParams={searchParams} />
            </Suspense>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-6" aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-xl font-bold">
              Contact details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{d.label}</dt>
                  <dd className="mt-0.5 font-medium">
                    {d.href ? (
                      <a
                        href={d.href}
                        className="hover:text-brand"
                        {...(d.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <a
              href={whatsappLink("Assalam o Alaikum! I have a printing enquiry.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn mt-5 w-full bg-green-600 text-white hover:bg-green-700"
            >
              Chat on WhatsApp
            </a>
          </section>
          <section className="card overflow-hidden" aria-label="Map">
            <iframe
              title="Mix Print Design location on Google Maps"
              src={MAP_EMBED_URL}
              className="h-72 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        </aside>
      </div>
    </>
  );
}

async function PrefilledForm({ searchParams }: { searchParams: PageProps<"/contact">["searchParams"] }) {
  const { subject } = await searchParams;
  return <ContactForm subject={typeof subject === "string" ? subject.slice(0, 150) : undefined} />;
}
