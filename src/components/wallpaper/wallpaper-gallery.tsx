import Link from "next/link";
import type { PublicWallpaperGallery } from "@/lib/wallpaper/queries";
import { WallpaperGrid } from "./wallpaper-grid";

/**
 * The 3D Wallpaper design gallery: category links (each with its own page and SEO), and the designs as a
 * lazy-loaded grid with a lightbox. Previews carry a light watermark; print files are never shown.
 */
export function WallpaperGallery({ gallery, basePath, activeSlug }: { gallery: PublicWallpaperGallery; basePath: string; activeSlug: string | null }) {
  const active = gallery.categories.find((c) => c.slug === activeSlug) ?? null;
  const designs = active ? gallery.designs.filter((d) => d.categoryId === active.id) : gallery.designs;
  const used = new Set(gallery.designs.map((d) => d.categoryId));
  const categories = gallery.categories.filter((c) => used.has(c.id) || c.id === active?.id);
  if (gallery.designs.length === 0) return null;

  return (
    <section id="gallery" aria-labelledby="gallery-heading" className="scroll-mt-24" data-testid="wallpaper-gallery">
      <h2 id="gallery-heading" className="text-2xl font-bold">
        {active ? `${active.name} 3D wallpaper designs` : "3D wallpaper design gallery"}
      </h2>
      <p className="mt-1 text-muted">Tap a design to see it larger, then “Choose this design” to price it for your wall.</p>
      {categories.length > 0 && (
        <nav className="app-scroll-row -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Design categories">
          <Link
            href={`${basePath}#gallery`}
            aria-current={!active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${!active ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
          >
            All designs
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`${basePath}/${c.slug}#gallery`}
              aria-current={c.id === active?.id ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${c.id === active?.id ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      {designs.length === 0 ? <p className="card mt-5 p-8 text-center text-muted">New designs are coming soon.</p> : <WallpaperGrid designs={designs} />}
    </section>
  );
}
