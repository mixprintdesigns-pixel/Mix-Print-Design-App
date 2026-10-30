import { WhatsAppIcon } from "@/components/icons/social-icons";
import { getSiteSettings, whatsappUrl } from "@/lib/content/site-settings";

/** Floating WhatsApp chat button, bottom-left on every page (the AI chat sits bottom-right). */
export async function WhatsAppFloat() {
  const settings = await getSiteSettings();
  return (
    <a
      href={whatsappUrl(settings, "Assalam o Alaikum! I have a printing enquiry.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-testid="whatsapp-float"
      className="fixed bottom-5 left-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-green-600 text-white shadow-lg transition hover:scale-105 hover:bg-green-700"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
