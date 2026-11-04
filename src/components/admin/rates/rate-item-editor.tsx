"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { removeRateItemImageAction, saveRateItemAction, uploadRateItemImageAction } from "@/app/admin/rates-actions";

type VariantRow = { label: string; rate: string; isVisible: boolean };
type Item = {
  id: string;
  section: string | null;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  rate: string;
  variantType: "NONE" | "GSM" | "SERIES";
  isVisible: boolean;
  sortOrder: number;
  live: boolean;
};

/** One item of a rate page: texts, rate (or GSM / series rates), image, show / hide and order. */
export function RateItemEditor({ item, gsmRows, seriesRows, sections }: { item: Item; gsmRows: VariantRow[]; seriesRows: VariantRow[]; sections: string[] }) {
  const [type, setType] = useState(item.variantType);
  const rows = type === "GSM" ? gsmRows : type === "SERIES" ? seriesRows : [];
  const listId = `sections-${item.id}`;

  return (
    <details className="card overflow-hidden" data-testid="rate-item-editor">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
        <span className="font-semibold">{item.name}</span>
        {item.subtitle && <span className="text-sm text-muted">· {item.subtitle}</span>}
        {item.section && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">{item.section}</span>}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${item.live ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}
        >
          {item.live ? "On the website" : !item.isVisible ? "Hidden" : "Not shown: set a rate"}
        </span>
      </summary>

      <div className="space-y-6 border-t border-border p-4">
        <ActionForm action={saveRateItemAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={item.id} />
          <label className="block">
            <span className="label">Name (H2 title)</span>
            <input name="name" className="input" defaultValue={item.name} required maxLength={120} />
          </label>
          <label className="block">
            <span className="label">Sub-title (e.g. Normal, Medium, Premium)</span>
            <input name="subtitle" className="input" defaultValue={item.subtitle ?? ""} maxLength={80} />
          </label>
          <label className="block">
            <span className="label">Section on the page (e.g. Flex, Stickers; optional)</span>
            <input name="section" className="input" defaultValue={item.section ?? ""} maxLength={60} list={listId} />
            <datalist id={listId}>
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Price by</span>
            <select name="variantType" className="input" value={type} onChange={(e) => setType(e.target.value as Item["variantType"])}>
              <option value="NONE">One rate per sq ft</option>
              <option value="GSM">GSM options (flex), each with its own rate</option>
              <option value="SERIES">Series options (stickers), each with its own rate</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Description: material, qualities, benefits, what it is proof against</span>
            <textarea name="description" className="input min-h-36" defaultValue={item.description ?? ""} maxLength={5000} />
            <span className="mt-1 block text-xs text-muted">
              Tips: a blank line starts a new paragraph · <code>**bold**</code> · lines starting with <code>- </code> make a bullet list (e.g. “- Waterproof”, “- UV resistant”, “- 3–5 years outdoor life”) · <code>### Heading</code> for a small heading.
            </span>
          </label>

          {type === "NONE" ? (
            <label className="block">
              <span className="label">Rate per sq ft (Rs)</span>
              <input name="rate" className="input" inputMode="decimal" defaultValue={item.rate} placeholder="0" />
              <span className="mt-1 block text-xs text-muted">0 = not shown on the website.</span>
            </label>
          ) : (
            <fieldset className="sm:col-span-2">
              <legend className="label">{type === "GSM" ? "GSM options" : "Series options"}: tick the ones you offer and set each rate per sq ft (Rs)</legend>
              <input type="hidden" name="v_count" value={rows.length} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r, i) => (
                  <div key={`${type}-${r.label}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <input type="hidden" name={`v_label_${i}`} value={r.label} />
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name={`v_on_${i}`} defaultChecked={r.isVisible} />
                      {r.label}
                    </label>
                    <input name={`v_rate_${i}`} className="input w-24" inputMode="decimal" defaultValue={r.rate} placeholder="0" aria-label={`Rate per sq ft for ${r.label}`} />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">Unticked options and options with rate 0 are not shown. The option lists are set on the main Rates page.</p>
            </fieldset>
          )}

          <label className="block">
            <span className="label">Image description (alt text)</span>
            <input name="imageAlt" className="input" defaultValue={item.imageAlt ?? ""} maxLength={200} />
          </label>
          <label className="block">
            <span className="label">Order on the page (lower first)</span>
            <input name="sortOrder" type="number" className="input" defaultValue={item.sortOrder} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input type="checkbox" name="isVisible" defaultChecked={item.isVisible} /> Show on the website
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Save item</SubmitButton>
          </div>
        </ActionForm>

        <div className="rounded-lg border border-border p-4">
          <p className="font-semibold">Image (optional)</p>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of the stored image
            <img src={item.imageUrl} alt={item.imageAlt ?? ""} className="mt-2 aspect-[16/9] w-full max-w-sm rounded-lg object-cover" />
          ) : (
            <p className="mt-1 text-sm text-muted">No image: the item shows without one.</p>
          )}
          <ActionForm action={uploadRateItemImageAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input max-w-xs" required aria-label={`Image for ${item.name}`} />
            <SubmitButton>Upload image</SubmitButton>
          </ActionForm>
          {item.imageUrl && (
            <ActionForm action={removeRateItemImageAction} className="mt-2">
              <input type="hidden" name="id" value={item.id} />
              <SubmitButton>Remove image</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </details>
  );
}
