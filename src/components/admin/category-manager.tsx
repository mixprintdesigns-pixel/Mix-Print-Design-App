"use client";

import { useActionState, useState, useTransition } from "react";
import {
  categoryCommandAction,
  deleteCategoryAction,
  saveCategoryAction,
  uploadCategoryImageAction,
  type AdminFormState,
} from "@/app/admin/actions";
import { slugify } from "./product-editor";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  parentId: string | null;
  sortOrder: number;
  isVisible: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  priceFromMinor: number | null;
  priceUnit: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  depth: number;
  path: string[];
  rootId: string;
  _count: { products: number; children: number };
};

const LEVELS = ["Main service", "Category", "Sub-category"];
const levelName = (depth: number) => LEVELS[depth] ?? `Level ${depth + 1}`;
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The shared category tree used by both the Services and Products pages:
 * Main service → Category → Sub-category → … (any depth). Products are assigned to any level.
 */
export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Looked up from the latest data so the form and image preview update after each save.
  const editing = categories.find((c) => c.id === editingId) ?? null;
  const [newParent, setNewParent] = useState<string>("");
  const [root, setRoot] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roots = categories.filter((c) => c.depth === 0);
  const shown = root ? categories.filter((c) => c.rootId === root) : categories;
  const hiddenAncestor = (c: Category) => categories.some((a) => !a.isVisible && a.id !== c.id && c.path.join("/").startsWith(`${a.path.join("/")}/`));

  // The form sits above the table on smaller screens; bring it into view when editing.
  const showForm = () => requestAnimationFrame(() => document.getElementById("category-form")?.scrollIntoView({ behavior: "smooth" }));
  const command = (c: Category, cmd: Parameters<typeof categoryCommandAction>[1]) =>
    startTransition(async () => setError((await categoryCommandAction(c.id, cmd)).error ?? null));

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_24rem]">
      <div id="category-form" className="scroll-mt-24 space-y-4 2xl:order-2">
        <CategoryForm
          key={editing?.id ?? `new-${newParent}`}
          category={editing}
          defaultParent={newParent}
          categories={categories}
          onDone={() => {
            setEditingId(null);
            setNewParent("");
          }}
        />
        {editing && <CategoryImage key={`img-${editing.id}`} category={editing} />}
      </div>
      <div className="min-w-0 2xl:order-1">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="root-filter" className="font-medium">
            Show
          </label>
          <select id="root-filter" className="input w-auto py-1.5" value={root} onChange={(e) => setRoot(e.target.value)}>
            <option value="">All main services</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="text-muted">{shown.length} categories</span>
        </div>
        <div className="card overflow-x-auto">
          {categories.length === 0 ? (
            <p className="p-8 text-center text-muted">No categories yet. Add your first main service.</p>
          ) : (
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Products</th>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${c.isVisible ? "" : "bg-surface/60 text-muted"}`} data-testid="category-row">
                    <td className="p-3" style={{ paddingLeft: `${0.75 + c.depth * 1.25}rem` }}>
                      <span className="flex items-center gap-2">
                        {c.depth > 0 && <span className="text-muted">└</span>}
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                          <img src={c.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="h-7 w-7 shrink-0 rounded bg-gradient-to-br from-brand/50 to-accent/50" aria-hidden />
                        )}
                        <span>
                          <span className="font-medium">{c.name}</span>
                          <span className="block text-xs text-muted">
                            {levelName(c.depth)} · /{c.path.join("/")} ·{" "}
                            {c.priceFromMinor != null ? `Rs ${c.priceFromMinor / 100}${c.priceUnit ? ` ${c.priceUnit}` : ""}` : "Get Quote"}
                          </span>
                        </span>
                        {!c.isVisible && <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs">Hidden</span>}
                        {c.isVisible && hiddenAncestor(c) && <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs">Parent hidden</span>}
                      </span>
                    </td>
                    <td className="p-3">{c._count.products}</td>
                    <td className="whitespace-nowrap p-3">
                      <button type="button" className="px-1.5 text-muted hover:text-foreground" disabled={pending} onClick={() => command(c, "up")} aria-label={`Move ${c.name} up`}>
                        ↑
                      </button>
                      <button type="button" className="px-1.5 text-muted hover:text-foreground" disabled={pending} onClick={() => command(c, "down")} aria-label={`Move ${c.name} down`}>
                        ↓
                      </button>
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">
                      <span className="ml-auto flex w-44 flex-wrap justify-end gap-x-3 gap-y-1">
                        <button type="button" className="font-semibold text-brand" onClick={() => {
                            setEditingId(c.id);
                            showForm();
                          }}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-brand"
                          onClick={() => {
                            setEditingId(null);
                            setNewParent(c.id);
                            showForm();
                          }}
                        >
                          + Sub
                        </button>
                        <button type="button" disabled={pending} onClick={() => command(c, c.isVisible ? "hide" : "show")}>
                          {c.isVisible ? "Hide" : "Show"}
                          <span className="sr-only"> {c.name}</span>
                        </button>
                        <a href={`/services/${c.path.join("/")}`} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground">
                          View
                        </a>
                        <button
                          type="button"
                          className="text-red-600"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(`Delete category “${c.name}”?`)) return;
                            startTransition(async () => setError((await deleteCategoryAction(c.id)).error ?? null));
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {error && (
            <p className="field-error p-3" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  defaultParent,
  categories,
  onDone,
}: {
  category: Category | null;
  defaultParent: string;
  categories: Category[];
  onDone: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [content, setContent] = useState(category?.content ?? "");
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(async (prev, data) => {
    const result = await saveCategoryAction(prev, data);
    if (result.ok && category) onDone();
    if (result.ok && !category) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setContent("");
    }
    return result;
  }, {});
  const errors = state.errors ?? {};
  const parentId = category?.parentId ?? defaultParent;
  const parent = categories.find((c) => c.id === parentId);
  const contentWords = words(content);

  return (
    <form action={formAction} className="card h-fit space-y-3 p-5" key={state.savedAt}>
      <h2 className="text-lg font-bold">
        {category ? `Edit “${category.name}”` : parent ? `Add inside “${parent.name}”` : "Add category"}
      </h2>
      {category && <input type="hidden" name="id" value={category.id} />}
      {errors._form && (
        <p className="field-error" role="alert">
          {errors._form}
        </p>
      )}
      {state.ok && !category && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          Category saved.
        </p>
      )}
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
        <span className="label">Slug (web address)</span>
        <input
          name="slug"
          className="input"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <span className="mt-1 block text-xs text-muted">
          /products/{[...(parent?.path ?? []), slug || "…"].join("/")}
        </span>
        {errors.slug && <span className="field-error block">{errors.slug}</span>}
      </label>
      <label className="block">
        <span className="label">Inside</span>
        <select name="parentId" className="input" defaultValue={parentId}>
          <option value="">Nothing: this is a main service</option>
          {categories
            .filter((c) => c.id !== category?.id && !(category && c.path.join("/").startsWith(`${category.path.join("/")}/`)))
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
        <span className="label">Short description</span>
        <textarea name="description" rows={2} className="input" defaultValue={category?.description ?? ""} maxLength={300} />
        <span className="mt-1 block text-xs text-muted">Shown on cards and used as the search description if none is set below.</span>
        {errors.description && <span className="field-error block">{errors.description}</span>}
      </label>
      <label className="block">
        <span className="label">Page description</span>
        <textarea name="content" rows={7} className="input" value={content} onChange={(e) => setContent(e.target.value)} maxLength={4000} />
        <span className={`mt-1 block text-xs ${contentWords > 0 && (contentWords < 100 || contentWords > 200) ? "text-amber-700 dark:text-amber-400" : "text-muted"}`}>
          {contentWords} words. 100–200 words works best for search engines. Leave a blank line between paragraphs.
        </span>
        {errors.content && <span className="field-error block">{errors.content}</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Starting price (Rs)</span>
          <input name="priceFrom" inputMode="decimal" className="input" placeholder="Get Quote" defaultValue={category?.priceFromMinor != null ? String(category.priceFromMinor / 100) : ""} />
          {errors.priceFrom && <span className="field-error block">{errors.priceFrom}</span>}
        </label>
        <label className="block">
          <span className="label">Price unit</span>
          <input name="priceUnit" className="input" placeholder="per sq. ft" defaultValue={category?.priceUnit ?? ""} maxLength={30} />
        </label>
      </div>
      <p className="text-xs text-muted">Leave the price empty to show “Get Quote”.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Sort order</span>
          <input name="sortOrder" type="number" min={0} className="input" defaultValue={category?.sortOrder ?? 0} />
          {errors.sortOrder && <span className="field-error block">{errors.sortOrder}</span>}
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="isVisible" defaultChecked={category?.isVisible ?? true} />
          Show on website
        </label>
      </div>
      <label className="block">
        <span className="label">Image description (alt text)</span>
        <input name="imageAlt" className="input" defaultValue={category?.imageAlt ?? ""} maxLength={200} placeholder={name ? `${name} printed by Mix Print Design` : ""} />
      </label>
      <details className="rounded-lg border border-border p-3" open={Boolean(category?.seoTitle || category?.seoDescription || errors.seoTitle || errors.seoDescription)}>
        <summary className="cursor-pointer text-sm font-semibold">Search engine (SEO)</summary>
        <label className="mt-3 block">
          <span className="label">SEO title</span>
          <input name="seoTitle" className="input" defaultValue={category?.seoTitle ?? ""} maxLength={70} placeholder="Automatic, e.g. Matte Business Cards Printing in Lahore | Mix Print Design" />
          {errors.seoTitle && <span className="field-error block">{errors.seoTitle}</span>}
        </label>
        <label className="mt-3 block">
          <span className="label">SEO description</span>
          <textarea name="seoDescription" rows={3} className="input" defaultValue={category?.seoDescription ?? ""} maxLength={160} placeholder="Automatic: uses the short description" />
          {errors.seoDescription && <span className="field-error block">{errors.seoDescription}</span>}
        </label>
      </details>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : category ? "Save category" : "Add category"}
        </button>
        {(category || defaultParent) && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
      {!category && <p className="text-xs text-muted">Save first, then click Edit to upload an image.</p>}
    </form>
  );
}

function CategoryImage({ category }: { category: Category }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await uploadCategoryImageAction(data);
          setMessage(result.error ? { error: result.error } : { ok: "Image uploaded." });
        });
      }}
    >
      <h2 className="font-bold">Image for “{category.name}”</h2>
      <input type="hidden" name="id" value={category.id} />
      {category.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of the stored image
        <img src={category.imageUrl} alt={category.imageAlt ?? ""} className="aspect-[16/10] w-full rounded-lg object-cover" />
      ) : (
        <p className="text-sm text-muted">No image yet: the website shows a coloured placeholder.</p>
      )}
      <label className="block">
        <span className="label">Upload JPG, PNG or WebP (max 4 MB)</span>
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input" required />
      </label>
      <label className="block">
        <span className="label">Image description (alt text)</span>
        <input name="imageAlt" className="input" defaultValue={category.imageAlt ?? category.name} maxLength={200} />
      </label>
      <p className="text-xs text-muted">Images are converted to WebP and saved with a descriptive file name automatically.</p>
      {message.error && (
        <p className="field-error" role="alert">
          {message.error}
        </p>
      )}
      {message.ok && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {message.ok}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload image"}
        </button>
        {category.imageUrl && (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await categoryCommandAction(category.id, "remove-image");
                setMessage(result.error ? { error: result.error } : { ok: "Image removed." });
              })
            }
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}
