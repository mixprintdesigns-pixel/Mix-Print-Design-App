"use client";

import { useEffect } from "react";

const COOKIE = "mp_ref_code"; // set by /r/<code> when a visitor arrives through an affiliate link

/**
 * Adds "Ref: CODE" to every WhatsApp message link when the visitor came through an affiliate link,
 * so staff can enter the code in Admin → Orders and the affiliate earns the commission.
 */
export function WhatsAppReferral() {
  useEffect(() => {
    const code = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([A-Za-z0-9]{4,20})`))?.[1];
    if (!code) return;
    const tag = (link: HTMLAnchorElement) => {
      const url = new URL(link.href);
      const text = url.searchParams.get("text") ?? "";
      // React may re-render the link (e.g. new options chosen), so check the message itself.
      if (text.endsWith(`Ref: ${code}`)) return;
      const message = `${text.replace(/\n?Ref: \w+$/, "")}${text ? "\n" : ""}Ref: ${code}`;
      // Same encoding as the other WhatsApp links (spaces as %20, not "+").
      link.href = `${url.origin}${url.pathname}?text=${encodeURIComponent(message)}`;
    };
    const update = () => document.querySelectorAll<HTMLAnchorElement>('a[href^="https://wa.me/"]').forEach(tag);
    update();
    // Pages and the order form change their links as the visitor browses and picks options.
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
