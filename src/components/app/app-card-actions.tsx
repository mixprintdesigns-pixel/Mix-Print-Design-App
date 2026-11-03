import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/social-icons";
import { whatsappLink } from "@/lib/business";

/**
 * App mode only (hidden on the normal website): the one action row of a service card, a big full-width "View"
 * button and a small WhatsApp icon button next to it. Replaces the website's "Get Quote" / "Order on WhatsApp" pair.
 */
export function AppCardActions({ href, subject, className = "" }: { href: string; subject: string; className?: string }) {
  return (
    <div className={`hidden items-center gap-2 app:flex ${className}`} data-testid="app-card-actions">
      <Link href={href} className="btn-primary flex-1">
        View<span className="sr-only"> {subject}</span>
      </Link>
      <a
        href={whatsappLink(`Assalam o Alaikum! I'd like a quote for ${subject}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-green-600 text-green-700 dark:text-green-400"
        aria-label={`Order ${subject} on WhatsApp`}
      >
        <WhatsAppIcon className="h-6 w-6" />
      </a>
    </div>
  );
}
