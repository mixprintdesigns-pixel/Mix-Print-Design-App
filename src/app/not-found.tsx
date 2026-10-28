import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">We couldn&apos;t find what you were looking for.</p>
      <Link href="/products" className="btn-primary mt-6">
        Browse products
      </Link>
    </div>
  );
}
