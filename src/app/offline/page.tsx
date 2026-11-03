import type { Metadata } from "next";
import { BrandBadge } from "@/components/brand-logo";

// Shown by the service worker (public/sw.js) when a page is opened without internet.

export const metadata: Metadata = { title: "You are offline", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <BrandBadge className="h-20 w-20" priority />
      <h1 className="mt-6 text-2xl font-bold">You are offline</h1>
      <p className="mt-3 text-muted">Please check your internet (Wi-Fi or mobile data) and try again.</p>
      <p className="mt-1 text-sm text-muted">Prices and orders always need the internet, so they are always up to date.</p>
      {/* A plain link (not client navigation), so the browser asks the network again. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn-primary mt-8">
        Try again
      </a>
    </div>
  );
}
