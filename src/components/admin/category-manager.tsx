"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCategoryAction, saveCategoryAction, type AdminFormState } from "@/app/admin/actions";
import { slugify } from "./product-editor";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  _count: { products: number; children: number };
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="card overflow-x-auto">
        {categories.length === 0 ? (
          <p className="p-8 text-center text-muted">No categories yet. Add your first one.</p>
        ) : (
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Slug</th>
                <th className="p-3 font-medium">Products</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium" style={{ paddingLeft: `${0.75 + c.depth * 1.25}rem` }}>
                    {c.depth > 0 && <span className="text-muted">└ </span>}
                    {c.name}
                  </td>
                  <td className="p-3 text-muted">{c.slug}</td>
                  <td className="p-3">{c._count.products}</td>
                  <td className="space-x-3 p-3 text-right">
                    <button type="button" className="font-semibold text-brand" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete category “${c.name}”?`)) return;
                        startTransition(async () => setDeleteError((await deleteCategoryAction(c.id)).error ?? null));
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {deleteError && (
          <p className="field-error p-3" role="alert">
            {deleteError}
          </p>
        )}
      </div>
      <CategoryForm key={editing?.id ?? "new"} category={editing} categories={categories} onDone={() => setEditing(null)} />
    </div>
  );
}

function CategoryForm({ category, categories, onDone }: { category: Category | null; categories: Category[]; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(async (prev, data) => {
    const result = await saveCategoryAction(prev, data);
    if (result.ok && category) onDone();
    if (result.ok && !category) {
      setName("");
      setSlug("");
      setSlugTouched(false);
    }
    return result;
  }, {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card h-fit space-y-3 p-5" key={state.savedAt}>
      <h2 className="text-lg font-bold">{category ? `Edit “${category.name}”` : "Add category"}</h2>
      {category && <input type="hidden" name="id" value={category.id} />}
      {errors._form && <p className="field-error" role="alert">{errors._form}</p>}
      {state.ok && !category && <p className="text-sm text-green-700 dark:text-green-400" role="status">Category saved.</p>}
      <label className="block">
        <span className="label">Name</span>
        <input
          name="name"
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
        {errors.name && <span className="field-error block">{errors.name}</span>}
      </label>
      <label className="block">
        <span className="label">Slug</span>
        <input
          name="slug"
          className="input"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        {errors.slug && <span className="field-error block">{errors.slug}</span>}
      </label>
      <label className="block">
        <span className="label">Parent category</span>
        <select name="parentId" className="input" defaultValue={category?.parentId ?? ""}>
          <option value="">None (top level)</option>
          {categories
            .filter((c) => c.id !== category?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {"— ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
        </select>
        {errors.parentId && <span className="field-error block">{errors.parentId}</span>}
      </label>
      <label className="block">
        <span className="label">Description</span>
        <textarea name="description" rows={2} className="input" defaultValue={category?.description ?? ""} maxLength={300} />
      </label>
      <label className="block">
        <span className="label">Sort order</span>
        <input name="sortOrder" type="number" min={0} className="input" defaultValue={category?.sortOrder ?? 0} />
        {errors.sortOrder && <span className="field-error block">{errors.sortOrder}</span>}
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : category ? "Save category" : "Add category"}
        </button>
        {category && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
