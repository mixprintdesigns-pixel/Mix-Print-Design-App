import Image from "next/image";
import Link from "next/link";
import { formatPKR } from "@/lib/money";
import { startingUnitPrice, type ProductCard as ProductCardData } from "@/lib/catalog/queries";

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images[0];
  return (
    <Link
      href={product.href}
      data-testid="product-card"
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-background">
        {!product.isAvailable && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
            Currently unavailable
          </span>
        )}
        {image && (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized={image.url.endsWith(".svg")}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{product.category.name}</p>
        <h3 className="mt-1 font-semibold group-hover:text-brand">{product.name}</h3>
        {product.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{product.summary}</p>}
        <p className="mt-auto pt-3 text-sm">
          From <span className="font-bold">{formatPKR(startingUnitPrice(product))}</span>
          <span className="text-muted">
            {" "}
            / unit · min {product.minQuantity} · {product.turnaroundDays}-day production
          </span>
        </p>
      </div>
    </Link>
  );
}
