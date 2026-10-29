import Image from "next/image";

/** Mix Print Design logo. The SVG uses dark text, so it sits on a light badge in dark mode. */
export function BrandLogo({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <span className="inline-block rounded-2xl bg-white/90 px-3 py-2 shadow-sm ring-1 ring-black/5">
      <Image src="/brand/mix-print-design-logo.svg" alt="Mix Print Design" width={360} height={96} priority className={className} unoptimized />
    </span>
  );
}
