import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/business";

/** Installable web app (and the base of the Android app on Google Play, a Trusted Web Activity). Colours: the logo blue. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BUSINESS.name,
    short_name: "Mix Print",
    description: "Printing, sign boards and design in Lahore, delivered across Pakistan.",
    // ?app=1 tells the page it was opened from the app icon (see components/app/app-mode.ts). The id stays "/".
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#00AFEF",
    theme_color: "#00AFEF",
    categories: ["business", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
