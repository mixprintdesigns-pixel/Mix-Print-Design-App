import "server-only";
import { headers } from "next/headers";

/** Absolute base URL for links people will share, e.g. https://mixprint.pk. Must run inside <Suspense>. */
export async function getSiteUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
