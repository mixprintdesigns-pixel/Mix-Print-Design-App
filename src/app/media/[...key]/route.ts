import { readLocalFile } from "@/lib/storage";

const types: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Serves files saved by the local storage driver (development and tests).
// In production on Vercel, uploads live in Vercel Blob and are served from its CDN instead.
export async function GET(_request: Request, ctx: RouteContext<"/media/[...key]">) {
  const key = (await ctx.params).key.join("/");
  const type = types[key.split(".").pop() ?? ""];
  if (!type) return new Response("Not found", { status: 404 });

  let bytes: Buffer | null;
  try {
    bytes = await readLocalFile(key);
  } catch {
    bytes = null;
  }
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
