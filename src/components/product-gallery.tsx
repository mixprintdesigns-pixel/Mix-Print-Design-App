"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { youTubeEmbedUrl, youTubeThumbnail } from "@/lib/youtube";

type GalleryImage = { id: string; url: string; alt: string };
/** The product's optional YouTube video. `first`: the main gallery item; otherwise it comes after the first image. */
export type GalleryVideo = { id: string; isShort: boolean; first: boolean; title: string };

export function ProductGallery({ images, video }: { images: GalleryImage[]; video?: GalleryVideo | null }) {
  // Products without a video keep exactly the gallery they had.
  return video ? <GalleryWithVideo images={images} video={video} /> : <ImageGallery images={images} />;
}

function ImageGallery({ images }: { images: GalleryImage[] }) {
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

// ─── With a video ────────────────────────────────────────────────────────────

type Item = { kind: "image"; image: GalleryImage } | { kind: "video" };

function GalleryWithVideo({ images, video }: { images: GalleryImage[]; video: GalleryVideo }) {
  const items: Item[] = images.map((image) => ({ kind: "image", image }));
  items.splice(video.first ? 0 : Math.min(1, items.length), 0, { kind: "video" });
  const [active, setActive] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = items[active] ?? items[0];
  const go = (i: number) => setActive((i + items.length) % items.length);

  return (
    <div>
      <div
        className="card relative aspect-[4/3] touch-pan-y overflow-hidden"
        data-testid="gallery-main"
        // Swipe left / right between the images and the video.
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
        }}
      >
        {current.kind === "video" ? (
          <VideoPlayer key={video.id} video={video} isFirstItem={active === 0} />
        ) : (
          <Image
            src={current.image.url}
            alt={current.image.alt}
            fill
            priority={active === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            unoptimized={current.image.url.endsWith(".svg")}
          />
        )}
      </div>
      {items.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product images">
          {items.map((item, i) => (
            <li key={item.kind === "video" ? "video" : item.image.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={item.kind === "video" ? `Play video: ${video.title}` : `Show image ${i + 1}: ${item.image.alt}`}
                aria-pressed={i === active}
                className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${
                  i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
                }`}
                data-testid={item.kind === "video" ? "gallery-video-thumb" : undefined}
              >
                {item.kind === "video" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youTubeThumbnail(video.id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    <PlayIcon className="h-7 w-7" />
                  </>
                ) : (
                  <Image src={item.image.url} alt="" fill sizes="96px" className="object-cover" unoptimized={item.image.url.endsWith(".svg")} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayIcon({ className }: { className: string }) {
  return (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center">
      <span className={`flex items-center justify-center rounded-full bg-black/70 text-white shadow ${className}`}>
        <svg viewBox="0 0 24 24" className="ml-0.5 h-1/2 w-1/2" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Shows only the video's thumbnail until the video is the selected item and on screen, then loads the
 * YouTube player (youtube-nocookie.com): muted, looping and playing inline. "Tap for sound" turns the sound on
 * without restarting. Browsers only allow autoplay without sound, so the sound needs the visitor's tap.
 */
function VideoPlayer({ video, isFirstItem }: { video: GalleryVideo; isFirstItem: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "100px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function turnSoundOn() {
    const send = (func: string, args: unknown[] = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    send("unMute");
    send("setVolume", [100]);
    send("playVideo"); // keeps playing from where it is
    setSound(true);
  }

  // Shorts are upright (9:16, full height); other videos 16:9 (full width), centred on black, inside the same box.
  const frameBox = video.isShort ? "h-full aspect-[9/16]" : "w-full aspect-video";

  return (
    <div ref={box} className="absolute inset-0 flex items-center justify-center bg-black" data-testid="gallery-video">
      {!load ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youTubeThumbnail(video.id)}
            alt={video.title}
            loading={isFirstItem ? "eager" : "lazy"}
            decoding="async"
            className={`${frameBox} object-cover`}
          />
          <PlayIcon className="h-16 w-16" />
        </>
      ) : (
        <div className={`relative ${frameBox} max-h-full max-w-full`}>
          <iframe
            ref={frame}
            src={youTubeEmbedUrl(video.id, typeof window !== "undefined" ? window.location.origin : undefined)}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
            data-testid="gallery-video-player"
          />
          {!sound && (
            <button
              type="button"
              onClick={turnSoundOn}
              className="absolute inset-0 flex cursor-pointer items-end justify-center bg-transparent pb-6"
              aria-label="Tap for sound"
              data-testid="video-sound"
            >
              <span className="whitespace-nowrap rounded-full bg-black/75 px-5 py-3 text-base font-semibold text-white shadow-lg ring-1 ring-white/30 sm:text-lg">🔊 Tap for sound</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
