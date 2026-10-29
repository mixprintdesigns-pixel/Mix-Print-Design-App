import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Private and transactional pages are kept out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/cart",
        "/checkout",
        "/account",
        "/login",
        "/register",
        "/api/",
        "/affiliate/dashboard",
        "/affiliate/verify",
        "/affiliate/join",
        "/r/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
