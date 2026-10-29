import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProductAction } from "@/app/admin/actions";
import { ImageManager } from "@/components/admin/image-manager";
import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProduct } from "@/lib/admin/catalog-service";
import { categoryChoices, toProductInput } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireStaff(["ADMIN"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [product, categories] = await Promise.all([getAdminProduct(id), categoryChoices()]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
        ← Products
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        {product.status === "PUBLISHED" && (
          <Link href={`/products/${product.slug}`} className="text-sm font-semibold text-brand" target="_blank">
            View in store ↗
          </Link>
        )}
      </div>
      {query.created && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
          Product created as a draft. Upload images below, then publish it.
        </p>
      )}
      {query.saved && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
          Product saved{product.status === "PUBLISHED" ? " and visible in the store" : ""}.
        </p>
      )}

      <div className="mt-6 space-y-6">
        <ImageManager productId={product.id} images={product.images} />
        {/* key: remount the editor with fresh ids after each save */}
        <ProductEditor
          key={product.updatedAt.toISOString()}
          productId={product.id}
          initial={toProductInput(product)}
          categories={categories}
          imageCount={product.images.length}
        />
        <section className="card border-red-200 p-5 dark:border-red-900">
          <h2 className="font-bold text-red-700 dark:text-red-400">Delete product</h2>
          <p className="mt-1 text-sm text-muted">
            Products that have been ordered are archived instead, so order history stays intact.
          </p>
          <form action={deleteProductAction} className="mt-3">
            <input type="hidden" name="id" value={product.id} />
            <button className="btn border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950">
              Delete product
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
