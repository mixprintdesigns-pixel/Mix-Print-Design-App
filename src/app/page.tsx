import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCategories, getFeaturedProducts } from "@/lib/catalog/queries";

// Catalog data is cached ("use cache"), so this whole page prerenders into the static shell.
export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Printing made simple</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Print that makes your brand <span className="text-brand">stand out.</span>
            </h1>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Business cards, flyers, banners, stickers and packaging. Upload your artwork or let our designers create
              it. Approve a proof, pay with JazzCash or Easypaisa, and track your order to your door.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary">
                Browse products
              </Link>
              <Link href="/products?category=business-cards" className="btn-secondary">
                Business cards
              </Link>
            </div>
          </div>
          <ol className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["1", "Choose & configure", "Size, paper, finish and quantity with live pricing."],
              ["2", "Upload or request design", "Send your file or brief our design team."],
              ["3", "Approve your proof", "Nothing is printed until you approve it."],
              ["4", "Track delivery", "Follow your order from press to doorstep."],
            ].map(([n, title, text]) => (
              <li key={n} className="card p-4">
                <span className="text-2xl font-black text-brand">{n}</span>
                <p className="mt-1 font-semibold">{title}</p>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Shop by category</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="card p-4 transition hover:border-brand"
            >
              <p className="font-semibold">{c.name}</p>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="text-2xl font-bold">Popular products</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
