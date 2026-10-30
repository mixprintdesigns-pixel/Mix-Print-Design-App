import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/icons/social-icons";
import { getCategoryTree } from "@/lib/catalog/queries";
import { pageMetadata } from "@/lib/content/seo-pages";
import { getSiteSettings, whatsappUrl } from "@/lib/content/site-settings";

export const generateMetadata = () => pageMetadata("contact");

const ENQUIRY = "Assalam o Alaikum! I have a printing enquiry.";

/** "https://www.facebook.com/mixprintdesign/" → "facebook.com/mixprintdesign" */
const shortUrl = (url: string) => url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  // Contact details, social links and map come from Admin → Contact & social.
  const [settings, tree] = await Promise.all([getSiteSettings(), getCategoryTree()]);
  const services = tree.map((s) => s.name);
  const details = [
    { label: "Phone", value: settings.phoneDisplay, href: `tel:+${settings.whatsappNumber}` },
    { label: "WhatsApp", value: settings.phoneDisplay, href: whatsappUrl(settings, ENQUIRY), external: true },
    { label: "Email", value: settings.email, href: `mailto:${settings.email}` },
    ...(settings.facebookUrl ? [{ label: "Facebook", value: shortUrl(settings.facebookUrl), href: settings.facebookUrl, external: true }] : []),
    { label: "Address", value: settings.address },
  ];
  const socials = [
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.youtubeUrl, label: "YouTube", Icon: YouTubeIcon },
  ].filter((s) => s.href);
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
            <Suspense fallback={<ContactForm services={services} />}>
              <PrefilledForm searchParams={searchParams} services={services} />
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
            {socials.length > 0 && (
              <ul className="mt-4 flex gap-2" aria-label="Follow us">
                {socials.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (opens in a new tab)`}
                      className="grid h-10 w-10 place-items-center rounded-full border border-border transition hover:border-brand hover:text-brand"
                    >
                      <Icon />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a
              href={whatsappUrl(settings, ENQUIRY)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn mt-5 w-full bg-green-600 text-white hover:bg-green-700"
            >
              Chat on WhatsApp
            </a>
          </section>
          {settings.mapEmbedUrl && (
            <section className="card overflow-hidden" aria-label="Map">
              <iframe
                title="Mix Print Design location on Google Maps"
                src={settings.mapEmbedUrl}
                className="h-72 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

async function PrefilledForm({ searchParams, services }: { searchParams: PageProps<"/contact">["searchParams"]; services: string[] }) {
  const { subject } = await searchParams;
  return <ContactForm subject={typeof subject === "string" ? subject.slice(0, 150) : undefined} services={services} />;
}
