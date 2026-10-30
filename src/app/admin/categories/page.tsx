import { CategoryManager } from "@/components/admin/category-manager";
import { categoryChoices } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";

// AI image generation can take up to a minute.
export const maxDuration = 120;

export const metadata = { title: "Categories & Services" };

export default async function AdminCategoriesPage() {
  await requireStaff(["ADMIN"]);
  const categories = await categoryChoices();
  return (
    <>
      <h1 className="text-2xl font-bold">Categories &amp; Services</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        One tree for both the Services and Products pages: Main service → Category → Sub-category (add as many levels as you need).
        Products assigned to any category appear there automatically on both pages. Hidden categories (and everything inside them)
        are not shown on the website.
      </p>
      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>
    </>
  );
}
