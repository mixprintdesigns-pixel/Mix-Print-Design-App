"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CHOOSE_DESIGN_EVENT } from "@/components/rates/rate-calculator";
import type { PublicWallpaperDesign } from "@/lib/wallpaper/queries";

/** The designs grid with a lightbox; "Choose this design" fills the design code in the 3D Wallpaper calculator. */
export function WallpaperGrid({ designs }: { designs: PublicWallpaperDesign[] }) {
  const [open, setOpen] = useState<{ design: PublicWallpaperDesign; image: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  function choose(code: string) {
    window.dispatchEvent(new CustomEvent(CHOOSE_DESIGN_EVENT, { detail: { code } }));
    setOpen(null);
    document.getElementById("rates")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const images = open ? [open.design.imageUrl, ...open.design.extraImages] : [];

  return (
    <>
      <ul className="app-list mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {designs.map((d) => (
          <li key={d.id} className="card overflow-hidden" data-testid="wallpaper-design">
            <button type="button" className="relative block aspect-[4/3] w-full bg-background" onClick={() => setOpen({ design: d, image: 0 })} aria-label={`View ${d.code} ${d.title} larger`}>
              <Image src={d.imageUrl} alt={`${d.title} (${d.code})`} fill loading="lazy" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
            </button>
            <div className="p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-accent">{d.code}</p>
              <p className="font-semibold leading-snug">{d.title}</p>
              <button type="button" className="btn-primary mt-2 w-full px-2 py-2 text-sm" onClick={() => choose(d.code)}>
                Choose this design
              </button>
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`${open.design.code} ${open.design.title}`} onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold">
              {open.design.code} · {open.design.title}
            </p>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl" aria-label="Close" onClick={() => setOpen(null)}>
              ×
            </button>
          </div>
          <div className="relative my-4 flex-1" onClick={(e) => e.stopPropagation()}>
            <Image src={images[open.image]} alt={`${open.design.title} (${open.design.code})`} fill sizes="100vw" className="object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 &&
              images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpen({ ...open, image: i })}
                  aria-label={`Preview ${i + 1}`}
                  aria-pressed={i === open.image}
                  className={`h-3 w-3 rounded-full ${i === open.image ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            <button type="button" className="btn-primary ml-2 px-5" onClick={() => choose(open.design.code)}>
              Choose this design
            </button>
          </div>
        </div>
      )}
    </>
  );
}
