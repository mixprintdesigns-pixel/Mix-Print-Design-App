import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, YouTubeIcon } from "@/components/icons/social-icons";
import { getSiteSettings, whatsappUrl } from "@/lib/content/site-settings";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const socials = [
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.youtubeUrl, label: "YouTube", Icon: YouTubeIcon },
    { href: whatsappUrl(settings), label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((s) => s.href);
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandLogo className="h-12 w-auto" />
          <p className="mt-2">Quality printing, delivered across Pakistan.</p>
          <ul className="mt-4 flex gap-2" aria-label="Social media">
            {socials.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (opens in a new tab)`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition hover:border-brand hover:text-brand"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">Contact us</p>
          <address className="mt-2 space-y-1 not-italic">
            <p>{settings.address}</p>
            <p>
              <a href={`tel:+${settings.whatsappNumber}`} className="hover:text-foreground">
                {settings.phoneDisplay}
              </a>
            </p>
            <p>
              <a href={`mailto:${settings.email}`} className="hover:text-foreground">
                {settings.email}
              </a>
            </p>
            <p>
              <a href={whatsappUrl(settings)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
                Chat on WhatsApp
              </a>
            </p>
          </address>
        </div>
        <div>
          <p className="font-semibold text-foreground">Pay with</p>
          <p className="mt-2">JazzCash · Easypaisa · Cash on delivery · Bank transfer</p>
          <p className="mt-4 font-semibold text-foreground">Need a design?</p>
          <p className="mt-2">Our designers can create your artwork and send proofs for approval.</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Affiliates</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/affiliate" className="hover:text-foreground">
                Affiliate program
              </Link>
            </li>
            <li>
              <Link href="/affiliate/join" className="hover:text-foreground">
                Become an affiliate
              </Link>
            </li>
            <li>
              <Link href="/affiliate/dashboard" className="hover:text-foreground">
                Affiliate dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
