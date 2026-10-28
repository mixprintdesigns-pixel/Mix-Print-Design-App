import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductConfigurator } from "@/components/product-configurator";
import { ProductGallery } from "@/components/product-gallery";
import { getProductBySlug } from "@/lib/catalog/queries";
import { formatPKR } from "@/lib/money";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.summary ?? undefined } : { title: "Not found" };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-[32rem] animate-pulse" />}>
        <ProductDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ProductDetail({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  return (
    <>
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>{" "}
        /{" "}
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-foreground">
          {product.category.name}
        </Link>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} />
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.summary && <p className="mt-2 text-lg text-muted">{product.summary}</p>}
          <p className="mt-2 text-sm text-muted">Ready in about {product.turnaroundDays} working days after proof approval.</p>
          <ProductConfigurator
            product={{
              id: product.id,
              basePriceMinor: product.basePriceMinor,
              minQuantity: product.minQuantity,
              quantityStep: product.quantityStep,
              priceTiers: product.priceTiers,
              options: product.options,
            }}
          />
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold">About this product</h2>
          <div className="mt-3 whitespace-pre-line leading-relaxed text-muted">{product.description}</div>
        </div>
        {product.priceTiers.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold">Volume pricing</h2>
            <p className="mt-1 text-xs text-muted">Base unit price, before options.</p>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {product.priceTiers.map((t) => (
                  <tr key={t.minQuantity} className="border-t border-border">
                    <td className="py-2">{t.minQuantity.toLocaleString()}+ units</td>
                    <td className="py-2 text-right font-semibold">{formatPKR(t.unitPriceMinor)} each</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
