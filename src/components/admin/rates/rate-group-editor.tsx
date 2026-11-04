"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { deleteRateGroupAction, removeRateItemImageAction, saveRateGroupAction, uploadRateItemImageAction } from "@/app/admin/rates-actions";

type Kind = "FLEX" | "STICKER" | "SIGN_BOARD";
type Button = { id: string; label: string; rate: string; isVisible: boolean; sortOrder: number };
type Group = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  rate: string;
  isVisible: boolean;
  sortOrder: number;
  featureIds: string[];
  buttons: Button[];
  live: boolean;
};

const WHAT: Record<Kind, string> = { FLEX: "button row", STICKER: "sticker type", SIGN_BOARD: "quality" };

/**
 * One row of buttons (Flex), sticker type (Sticker) or quality (Sign Board), with everything it shows:
 * its buttons and rates, or for a quality its rate, feature ticks, description and image.
 */
type Props = { kind: Kind; group: Group; index: number; features: { id: string; label: string }[] };

export function RateGroupEditor(props: Props) {
  const { kind, group } = props;
  // The form starts afresh whenever buttons are added or deleted, so new rows are never sent twice.
  const formKey = group.buttons.map((b) => b.id).join(",");
  return (
    <details className="rounded-xl border border-border bg-surface" data-testid="rate-group-editor">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
        <span className="font-semibold">{group.name}</span>
        {group.subtitle && <span className="text-sm text-muted">· {group.subtitle}</span>}
        <span className="text-xs text-muted">({WHAT[kind]})</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${group.live ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}
        >
          {group.live ? "On the website" : !group.isVisible ? "Hidden" : "Not shown: set a rate"}
        </span>
      </summary>

      <div className="space-y-5 border-t border-border p-4">
        <GroupForm key={formKey} {...props} />
        {kind === "SIGN_BOARD" && (
          <div className="rounded-lg border border-border p-4">
            <p className="font-semibold">Image (optional)</p>
            {group.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of the stored image
              <img src={group.imageUrl} alt={group.imageAlt ?? ""} className="mt-2 aspect-[16/9] w-full max-w-sm rounded-lg object-cover" />
            ) : (
              <p className="mt-1 text-sm text-muted">No image.</p>
            )}
            <ActionForm action={uploadRateItemImageAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={group.id} />
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                className="input max-w-xs"
                required
                aria-label={`Image for ${group.name}`}
              />
              <SubmitButton>Upload image</SubmitButton>
            </ActionForm>
            {group.imageUrl && (
              <ActionForm action={removeRateItemImageAction} className="mt-2">
                <input type="hidden" name="id" value={group.id} />
                <SubmitButton>Remove image</SubmitButton>
              </ActionForm>
            )}
          </div>
        )}

        <ActionForm action={deleteRateGroupAction} confirm={`Delete “${group.name}” and all its rates? This cannot be undone.`}>
          <input type="hidden" name="id" value={group.id} />
          <SubmitButton className="btn border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
            Delete this {WHAT[kind]}
          </SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}

function GroupForm({ kind, group, index, features }: Props) {
  const [rows, setRows] = useState<Button[]>(group.buttons.length ? group.buttons : [{ id: "", label: "", rate: "", isVisible: true, sortOrder: 0 }]);
  const addRow = () => setRows((r) => [...r, { id: "", label: "", rate: "", isVisible: true, sortOrder: (r.at(-1)?.sortOrder ?? -1) + 1 }]);
  const nameLabel =
    kind === "SIGN_BOARD"
      ? "Quality name (card title)"
      : kind === "STICKER"
        ? "Sticker type (column title, e.g. Vinyl)"
        : index === 0
          ? "Row name (this first row sits under the section title; its name is used in orders, e.g. Flex)"
          : "Bar title (e.g. Most Famous Flex Names)";

  return (
    <ActionForm action={saveRateGroupAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={group.id} />
      <label className="block">
        <span className="label">{nameLabel}</span>
        <input name="name" className="input" defaultValue={group.name} required maxLength={120} />
      </label>
      {kind === "SIGN_BOARD" ? (
        <>
          <label className="block">
            <span className="label">Text on the rate button (e.g. Normal, Medium, Premium)</span>
            <input name="subtitle" className="input" defaultValue={group.subtitle ?? ""} maxLength={80} />
          </label>
          <label className="block">
            <span className="label">Rate per sq ft (Rs)</span>
            <input name="rate" className="input" inputMode="decimal" defaultValue={group.rate} placeholder="0" />
            <span className="mt-1 block text-xs text-muted">0 = not shown on the website.</span>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="label">Features this quality includes (the others show greyed out)</legend>
            {features.length === 0 ? (
              <p className="text-sm text-muted">No features yet: add them in “Features list” on the main Rates page.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {features.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input type="checkbox" name={`feature_${f.id}`} defaultChecked={group.featureIds.includes(f.id)} />
                    {f.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <label className="block sm:col-span-2">
            <span className="label">Description</span>
            <textarea name="description" className="input min-h-28" defaultValue={group.description ?? ""} maxLength={5000} />
            <span className="mt-1 block text-xs text-muted">
              A blank line starts a new paragraph · <code>**bold**</code> · lines starting with <code>- </code> make a list.
            </span>
          </label>
          <label className="block">
            <span className="label">Image description (alt text)</span>
            <input name="imageAlt" className="input" defaultValue={group.imageAlt ?? ""} maxLength={200} />
          </label>
        </>
      ) : (
        <fieldset className="sm:col-span-2">
          <legend className="label">
            Buttons: the text on top (e.g. {kind === "STICKER" ? "1000 Series" : index === 0 ? "240 GSM" : "China Flex 240 GSM"}) and the rate per sq ft below
            (Rs)
          </legend>
          <input type="hidden" name="b_count" value={rows.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 pr-2">Button text</th>
                  <th className="py-1 pr-2">Rate (Rs)</th>
                  <th className="py-1 pr-2">Order</th>
                  <th className="py-1 pr-2">Show</th>
                  <th className="py-1">Delete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || `new-${i}`}>
                    <td className="py-1 pr-2">
                      <input type="hidden" name={`b_id_${i}`} value={r.id} />
                      <input name={`b_label_${i}`} className="input" defaultValue={r.label} maxLength={60} aria-label={`Button ${i + 1} text`} />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        name={`b_rate_${i}`}
                        className="input w-24"
                        inputMode="decimal"
                        defaultValue={r.rate}
                        placeholder="0"
                        aria-label={`Button ${i + 1} rate`}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input name={`b_order_${i}`} type="number" className="input w-20" defaultValue={r.sortOrder} aria-label={`Button ${i + 1} order`} />
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input type="checkbox" name={`b_on_${i}`} defaultChecked={r.isVisible} aria-label={`Show button ${i + 1}`} />
                    </td>
                    <td className="py-1 text-center">
                      <input type="checkbox" name={`b_del_${i}`} aria-label={`Delete button ${i + 1}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-secondary mt-2 px-3 py-1.5 text-xs" onClick={addRow}>
            + Add a button
          </button>
          <p className="mt-1 text-xs text-muted">Buttons with rate 0 or not shown stay off the website. Lower order numbers come first.</p>
        </fieldset>
      )}
      <label className="block">
        <span className="label">Order in the section (lower first)</span>
        <input name="sortOrder" type="number" className="input" defaultValue={group.sortOrder} />
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
        <input type="checkbox" name="isVisible" defaultChecked={group.isVisible} /> Show on the website
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
