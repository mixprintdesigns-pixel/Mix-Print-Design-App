import Image from "next/image";
import { BUSINESS } from "@/lib/business";

const ALT = `${BUSINESS.name} logo`;

/**
 * The Mix Print Design wordmark: dark lettering in light mode, white "X" and "Print" in dark mode.
 * The browser picks the file for the device's colour scheme (the same media query the site's dark mode uses),
 * so only one is downloaded. Both files share one size (21 × 6), so the logo never shifts. Only the height is set.
 */
export function BrandLogo({ className = "h-16 w-auto", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <picture>
      <source srcSet="/brand/logo-dark.svg" media="(prefers-color-scheme: dark)" type="image/svg+xml" />
      {/* An SVG needs no resizing, so a plain <img> keeps it sharp at every size. */}
      <img
        src="/brand/logo-light.svg"
        alt={ALT}
        width={350}
        height={100}
        className={className}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}

/** The round Mix Print Design icon (the site icon), used where a small square mark fits better. */
export function BrandBadge({ className = "h-10 w-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/mix-print-design-icon.png"
      alt={ALT}
      width={512}
      height={512}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
