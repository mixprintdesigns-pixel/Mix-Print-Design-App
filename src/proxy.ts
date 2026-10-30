import { NextResponse, type NextRequest } from "next/server";

// Permanent (301) redirects for old /products?category=… links, including the removed
// "Business cards" and "Marketing" header pages. Categories now have clean URLs.
const LEGACY_CATEGORY_PATHS: Record<string, string> = {
  "business-cards": "/products/offset-printing/business-cards",
  marketing: "/products",
  "large-format": "/products/digital-printing/standees-roll-up-banners",
  "stickers-labels": "/products/offset-printing/stickers-labels",
  packaging: "/products/offset-printing/packaging-boxes",
  stationery: "/products/offset-printing/letterheads",
};

export function proxy(request: NextRequest) {
  // Orders go through WhatsApp; the cart page is switched off (its code and data are kept).
  if (request.nextUrl.pathname === "/cart") return NextResponse.redirect(new URL("/products", request.url), 307);
  const category = request.nextUrl.searchParams.get("category");
  if (category === null) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = LEGACY_CATEGORY_PATHS[category] ?? "/products";
  url.searchParams.delete("category");
  return NextResponse.redirect(url, 301);
}

export const config = { matcher: ["/products", "/cart"] };
