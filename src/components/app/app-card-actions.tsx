import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/social-icons";
import { whatsappLink } from "@/lib/business";

/**
 * App mode only (hidden on the normal website): the round button in the bottom-right corner of a photo card.
 * It opens the item, or WhatsApp for items whose price is on request. (Tapping anywhere else on the card also
 * opens the item.)
 */
export function AppCardActions({ href, subject, priceOnRequest = false }: { href: string; subject: string; priceOnRequest?: boolean }) {
  if (priceOnRequest) {
    return (
      <a
        href={whatsappLink(`Assalam o Alaikum! I'd like a quote for ${subject}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className="app-fab app-fab-wa hidden"
        aria-label={`Ask the price of ${subject} on WhatsApp`}
        data-testid="app-card-actions"
      >
        <WhatsAppIcon className="h-6 w-6" />
      </a>
    );
  }
  return (
    <Link href={href} className="app-fab hidden" aria-label={`Open ${subject}`} data-testid="app-card-actions">
      <ArrowIcon />
    </Link>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
