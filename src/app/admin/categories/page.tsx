import { CategoryManager } from "@/components/admin/category-manager";
import { categoryChoices } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireStaff(["ADMIN"]);
  const categories = await categoryChoices();
  return (
    <>
      <h1 className="text-2xl font-bold">Categories</h1>
      <p className="mt-1 text-sm text-muted">Organise products into categories and subcategories.</p>
      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>
    </>
  );
}
