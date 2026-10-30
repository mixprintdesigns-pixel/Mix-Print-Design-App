import Image from "next/image";
import Link from "next/link";
import { listAdminProducts } from "@/lib/admin/catalog-service";
import { requireStaff } from "@/lib/auth/session";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Products" };

const statusStyle: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ARCHIVED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireStaff(["ADMIN"]);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const products = await listAdminProducts({ q, status });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">
          Add product
        </Link>
      </div>
      {params.hidden && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300" role="status">Product hidden from the website (status Archived).</p>}
      {params.archived && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300" role="status">
          This product has orders, so it was archived instead of deleted. It is hidden from the store.
        </p>
      )}

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/products">
        <input type="search" name="q" defaultValue={q} placeholder="Search name, SKU or slug" className="input max-w-xs" aria-label="Search products" />
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {products.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-muted">
          No products yet.{" "}
          <Link href="/admin/products/new" className="font-semibold text-brand">
            Add your first product
          </Link>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Base price</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-brand">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-background">
                        {p.images[0] && (
                          <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" unoptimized={p.images[0].url.endsWith(".svg")} />
                        )}
                      </span>
                      <span>
                        {p.name}
                        <span className="block text-xs font-normal text-muted">{p.sku}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="p-3">{p.category.name}</td>
                  <td className="p-3">{formatPKR(p.basePriceMinor)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[p.status]}`}>{p.status.toLowerCase()}</span>
                    {!p.isAvailable && <span className="ml-1 text-xs text-muted">unavailable</span>}
                    {p.isFeatured && <span className="ml-1 text-xs text-accent">featured</span>}
                  </td>
                  <td className="p-3 text-muted">{p.updatedAt.toLocaleDateString("en-PK")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
