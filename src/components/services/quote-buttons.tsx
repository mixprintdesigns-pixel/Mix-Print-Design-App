import Link from "next/link";
import { quoteLink, whatsappLink } from "@/lib/business";

/** "Get Quote" (contact form, pre-filled) and WhatsApp buttons for any service level. */
export function QuoteButtons({ subject, compact = false }: { subject: string; compact?: boolean }) {
  const size = compact ? "px-3 py-1.5 text-xs" : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={quoteLink(subject)} className={`btn-primary ${size}`}>
        Get Quote
      </Link>
      <a
        href={whatsappLink(`Assalam o Alaikum! I'd like a quote for ${subject}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn border border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 ${size}`}
      >
        WhatsApp
      </a>
    </div>
  );
}
