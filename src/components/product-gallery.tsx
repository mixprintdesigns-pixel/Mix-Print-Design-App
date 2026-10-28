"use client";

import Image from "next/image";
import { useState } from "react";

type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (!current) return <div className="card aspect-[4/3]" />;

  return (
    <div>
      <div className="card relative aspect-[4/3] overflow-hidden">
        <Image
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          unoptimized={current.url.endsWith(".svg")}
        />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}: ${image.alt}`}
                aria-pressed={i === active}
                className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${
                  i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized={image.url.endsWith(".svg")}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
