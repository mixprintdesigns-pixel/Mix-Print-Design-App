import Image from "next/image";
import type { GalleryImage } from "@/lib/catalog/gallery";

/** The extra images of a service page, as a row that scrolls sideways on phones. */
export function CategoryGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  return (
    <section aria-label={`${name} photos`} data-testid="category-gallery">
      <ul className="app-scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {images.map((img) => (
          <li key={img.id} className="relative aspect-[4/3] w-64 shrink-0 snap-start overflow-hidden rounded-xl bg-background sm:w-auto">
            <Image src={img.url} alt={img.alt || name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 16rem" className="object-cover" loading="lazy" unoptimized={img.url.endsWith(".svg")} />
          </li>
        ))}
      </ul>
    </section>
  );
}
