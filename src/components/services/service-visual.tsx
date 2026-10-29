import Image from "next/image";

const gradients = [
  "from-brand/80 to-accent/70",
  "from-accent/80 to-amber-400/70",
  "from-amber-400/80 to-brand/70",
];

/** Service image, or a branded gradient with the title's initials when no image has been uploaded yet. */
export function ServiceVisual({ title, imageUrl, index = 0, sizes = "(min-width: 1024px) 33vw, 100vw" }: { title: string; imageUrl: string | null; index?: number; sizes?: string }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-background">
      {imageUrl ? (
        <Image src={imageUrl} alt={title} fill sizes={sizes} className="object-cover" unoptimized={imageUrl.endsWith(".svg")} />
      ) : (
        <div className={`grid h-full place-items-center bg-gradient-to-br ${gradients[index % gradients.length]}`} aria-hidden>
          <span className="text-5xl font-black tracking-tight text-white/90 drop-shadow">
            {title
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 3)
              .toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
