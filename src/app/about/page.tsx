import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS, quoteLink, whatsappLink } from "@/lib/business";
import { getAboutContent } from "@/lib/content/about";

export const metadata: Metadata = {
  title: "About us",
  description: "Mix Print Design is a printing, signage and design studio on Raiwind Road, Lahore.",
};

export default async function AboutPage() {
  const about = await getAboutContent();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">About us</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Printing and signage from the heart of <span className="text-brand">Lahore</span>.
          </h1>
          <p className="mt-3 text-muted">{BUSINESS.address}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="story-heading">
          <h2 id="story-heading" className="text-2xl font-bold">
            Our story
          </h2>
          <div className="mt-3 space-y-4 whitespace-pre-line leading-relaxed text-muted">{about.story}</div>
          <div className="card mt-8 border-l-4 border-l-brand p-6">
            <h2 className="text-lg font-bold">Our mission</h2>
            <p className="mt-2 leading-relaxed">{about.mission}</p>
          </div>
        </section>

        <section className="card h-fit overflow-hidden" aria-labelledby="owner-heading">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-brand/20 to-accent/20">
            {about.ownerPhotoUrl ? (
              <Image src={about.ownerPhotoUrl} alt={about.ownerName} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-6xl font-black text-white/90" aria-hidden>
                {about.ownerName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Meet the owner</p>
            <h2 id="owner-heading" className="mt-1 text-xl font-bold">
              {about.ownerName}
            </h2>
            {about.ownerTitle && <p className="text-sm text-muted">{about.ownerTitle}</p>}
            {about.ownerBio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{about.ownerBio}</p>}
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-6" aria-labelledby="why-heading">
        <h2 id="why-heading" className="text-2xl font-bold">
          Why choose us
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {about.highlights.map((h, i) => (
            <li key={h.title} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 font-black text-brand" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{h.title}</h3>
              <p className="mt-1 text-sm text-muted">{h.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-br from-brand/10 to-accent/10 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Let&apos;s print something great together</h2>
            <p className="text-muted">Visit us on Raiwind Road or message us on WhatsApp at {BUSINESS.phoneDisplay}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={quoteLink()} className="btn-primary">
              Get a Quote
            </Link>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              WhatsApp us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
