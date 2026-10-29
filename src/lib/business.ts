// Mix Print Design business details, used by the contact page, WhatsApp buttons and the AI assistant.

export const BUSINESS = {
  name: "Mix Print Design",
  email: "mixprintdesigns@gmail.com",
  phoneDisplay: "+92 303 488 9255",
  phoneTel: "+923034889255",
  whatsappNumber: "923034889255",
  address: "Raiwind Road, Lahore, Pakistan",
  facebookUrl: "https://facebook.com/mixprintdesign",
  mapQuery: "Mix Print Design, Raiwind Road, Lahore",
} as const;

/** WhatsApp click-to-chat link with an optional pre-filled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${BUSINESS.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** WhatsApp link to a customer's Pakistani mobile number, or null if the number is not a mobile. */
export function whatsappLinkTo(phone: string): string | null {
  const digits = phone.replace(/[\s-]/g, "");
  const match = /^(?:\+92|0092|92|0)(3\d{9})$/.exec(digits);
  return match ? `https://wa.me/92${match[1]}` : null;
}

/** Contact page link that pre-fills the quote subject. */
export function quoteLink(subject?: string): string {
  return subject ? `/contact?subject=${encodeURIComponent(`Quote: ${subject}`)}` : "/contact?subject=Quote";
}

export const MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(BUSINESS.mapQuery)}&output=embed`;
