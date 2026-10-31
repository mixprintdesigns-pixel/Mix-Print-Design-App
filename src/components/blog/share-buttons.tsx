"use client";

import { useState } from "react";
import { FacebookIcon, WhatsAppIcon } from "@/components/icons/social-icons";

/** Share an article on WhatsApp or Facebook, or copy its link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const button = "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this article">
      <span className="text-sm font-semibold">Share:</span>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className={button} data-testid="share-whatsapp">
        <WhatsAppIcon className="h-4 w-4 text-green-600" /> WhatsApp
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={button} data-testid="share-facebook">
        <FacebookIcon className="h-4 w-4 text-[#1877F2]" /> Facebook
      </a>
      <button
        type="button"
        className={button}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link:", url);
          }
        }}
      >
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
