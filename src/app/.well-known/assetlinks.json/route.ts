import { connection } from "next/server";
import { assetLinks } from "@/lib/pwa/asset-links";

// /.well-known/assetlinks.json: read on each request, so new values in Vercel apply after a redeploy without code changes.
export async function GET(): Promise<Response> {
  await connection();
  return Response.json(assetLinks(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
