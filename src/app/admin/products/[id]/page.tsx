import Link from "next/link";
import { notFound } from "next/navigation";
import { hideProductAction } from "@/app/admin/actions";
import { ImageManager } from "@/components/admin/image-manager";
import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProduct } from "@/lib/admin/catalog-service";
import { categoryChoices, toProductInput } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";

// AI image generation can take up to a minute.
export const maxDuration = 120;

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
        {product.status !== "ARCHIVED" && (
          <section className="card p-5">
            <h2 className="font-bold">Hide product</h2>
            <p className="mt-1 text-sm text-muted">
              Hides the product from the website (status “Archived”). Nothing is deleted: set the status back to Published to show it again.
            </p>
            <form action={hideProductAction} className="mt-3">
              <input type="hidden" name="id" value={product.id} />
              <button className="btn-secondary">Hide product</button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
