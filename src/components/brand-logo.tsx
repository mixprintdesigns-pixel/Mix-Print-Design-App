import Image from "next/image";
import { BUSINESS } from "@/lib/business";

const ALT = `${BUSINESS.name} logo`;

/**
 * The Mix Print Design wordmark. Its lettering is dark, so in dark mode the round badge is shown instead.
 * Never stretched or recoloured: only the height is set.
 */
export function BrandLogo({ className = "h-16 w-auto", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Wordmark className={`${className} dark:hidden`} priority={priority} />
      <BrandBadge className={`${className} hidden aspect-square dark:inline-block`} />
    </>
  );
}

function Wordmark({ className, priority }: { className: string; priority: boolean }) {
  return (
    <Image
      src="/brand/mix-print-design-logo.svg"
      alt={ALT}
      width={350}
      height={100}
      className={className}
      unoptimized
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

/** The round Mix Print Design badge (works on light and dark backgrounds). */
export function BrandBadge({ className = "h-10 w-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/mix-print-design-badge.webp"
      alt={ALT}
      width={512}
      height={512}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
