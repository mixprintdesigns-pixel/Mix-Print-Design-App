import { deleteBlogCategoryAction, saveBlogCategoryAction } from "@/app/admin/blog-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BlogTabs } from "@/components/admin/blog/blog-tabs";
import { requireStaff } from "@/lib/auth/session";
import { listBlogCategoriesForAdmin } from "@/lib/blog/admin";

export const metadata = { title: "Blog categories" };

export default async function BlogCategoriesPage() {
  await requireStaff(["ADMIN"]);
  const categories = await listBlogCategoriesForAdmin();
  return (
    <>
      <h1 className="text-2xl font-bold">Blog</h1>
      <BlogTabs current="categories" />

      <ActionForm action={saveBlogCategoryAction} className="card mt-4 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
        <h2 className="text-lg font-bold sm:col-span-4">Add a category</h2>
        <label className="block">
          <span className="label">Name</span>
          <input name="name" className="input" required maxLength={80} placeholder="e.g. Printing Tips" />
        </label>
        <label className="block">
          <span className="label">Description (optional)</span>
          <input name="description" className="input" maxLength={300} />
        </label>
        <label className="block">
          <span className="label">Order</span>
          <input name="sortOrder" type="number" min={0} max={999} defaultValue={categories.length + 1} className="input" />
        </label>
        <SubmitButton className="btn-primary">Add category</SubmitButton>
      </ActionForm>

      <ul className="mt-6 space-y-3">
        {categories.map((c) => (
          <li key={c.id} className="card p-4" data-testid="blog-category-row">
            <ActionForm action={saveBlogCategoryAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_5rem_auto] sm:items-end">
              <input type="hidden" name="categoryId" value={c.id} />
              <label className="block">
                <span className="label">Name</span>
                <input name="name" defaultValue={c.name} className="input" required maxLength={80} />
              </label>
              <label className="block">
                <span className="label">URL</span>
                <input name="slug" defaultValue={c.slug} className="input font-mono text-sm" maxLength={80} />
              </label>
              <label className="block">
                <span className="label">Description</span>
                <input name="description" defaultValue={c.description ?? ""} className="input" maxLength={300} />
              </label>
              <label className="block">
                <span className="label">Order</span>
                <input name="sortOrder" type="number" min={0} max={999} defaultValue={c.sortOrder} className="input" />
              </label>
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>
                {c._count.posts} article{c._count.posts === 1 ? "" : "s"}
              </span>
              <ActionForm action={deleteBlogCategoryAction} confirm={`Delete the category “${c.name}”? Its articles are kept, without a category.`}>
                <input type="hidden" name="categoryId" value={c.id} />
                <SubmitButton className="px-2 py-1 text-xs font-semibold text-red-700 hover:underline dark:text-red-400">Delete category</SubmitButton>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
