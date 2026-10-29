import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatWidget } from "@/components/chat/chat-widget";
import { JsonLd } from "@/components/catalog/json-ld";
import { localBusinessJsonLd, OPEN_GRAPH_DEFAULTS, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Mix Print Design | Printing & Sign Boards in Lahore", template: "%s | Mix Print Design" },
  description:
    "Business cards, offset and digital printing, flex, sign boards and customized printing from Raiwind Road, Lahore, delivered across Pakistan.",
  openGraph: OPEN_GRAPH_DEFAULTS,
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ChatWidget />
        <JsonLd data={localBusinessJsonLd()} />
      </body>
    </html>
  );
}
