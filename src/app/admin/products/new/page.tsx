import Link from "next/link";
import { ProductEditor } from "@/components/admin/product-editor";
import { categoryChoices, EMPTY_PRODUCT } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireStaff(["ADMIN"]);
  const categories = await categoryChoices();
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
        ← Products
      </Link>
      <h1 className="mt-1 text-2xl font-bold">Add product</h1>
      {categories.length === 0 ? (
        <p className="card mt-6 p-6">
          Create a category first.{" "}
          <Link href="/admin/categories" className="font-semibold text-brand">
            Manage categories
          </Link>
        </p>
      ) : (
        <div className="mt-6">
          <ProductEditor initial={EMPTY_PRODUCT} categories={categories} imageCount={0} />
        </div>
      )}
    </>
  );
}
