import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog/queries";
import { categoryUrl, serviceUrl } from "@/lib/catalog/tree";

export default async function NotFound() {
  const services = await getCategoryTree();
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">This page has moved or no longer exists. These links will help you find what you need:</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/products" className="btn-primary">
          Browse products
        </Link>
        <Link href="/services" className="btn-secondary">
          Our services
        </Link>
        <Link href="/contact" className="btn-secondary">
          Contact us
        </Link>
      </div>
      {services.length > 0 && (
        <ul className="mt-10 grid gap-3 text-left sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className="card p-4">
              <Link href={serviceUrl(s.path)} className="font-semibold hover:text-brand">
                {s.name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {s.children.slice(0, 4).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && " · "}
                    <Link href={categoryUrl(c.path)} className="hover:text-brand">
                      {c.name}
                    </Link>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
