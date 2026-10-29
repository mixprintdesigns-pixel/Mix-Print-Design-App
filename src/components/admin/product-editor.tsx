"use client";

import { cloneElement, useActionState, useId, useState } from "react";
import { saveProductAction, type AdminFormState } from "@/app/admin/actions";
import { OPTION_KINDS, type ProductInput } from "@/lib/admin/product-input";

type Category = { id: string; name: string; depth: number };

// List rows carry a client-only `key` so React keeps inputs stable while rows are added/removed.
type Row<T> = T & { key: string };
type OptionRow = Row<Omit<ProductInput["options"][number], "values"> & { values: Row<ProductInput["options"][number]["values"][number]>[] }>;
type EditorState = Omit<ProductInput, "options" | "priceTiers" | "bulkDiscounts"> & {
  priceTiers: Row<ProductInput["priceTiers"][number]>[];
  bulkDiscounts: Row<ProductInput["bulkDiscounts"][number]>[];
  options: OptionRow[];
};

let counter = 0;
const key = () => `k${++counter}`;
const withKeys = <T,>(items: T[]) => items.map((item) => ({ ...item, key: key() }));
const stripKeys = <T extends { key: string }>(items: T[]) => items.map(({ key: _key, ...rest }) => rest);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const KIND_LABEL: Record<(typeof OPTION_KINDS)[number], string> = {
  SIZE: "Size",
  MATERIAL: "Material",
  FINISHING: "Finishing",
  OTHER: "Other",
};

export function ProductEditor({
  productId,
  initial,
  categories,
  imageCount,
}: {
  productId?: string;
  initial: ProductInput;
  categories: Category[];
  imageCount: number;
}) {
  const [state, setState] = useState<EditorState>(() => ({
    ...initial,
    priceTiers: withKeys(initial.priceTiers),
    bulkDiscounts: withKeys(initial.bulkDiscounts),
    options: initial.options.map((o) => ({ ...o, key: key(), values: withKeys(o.values) })),
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(productId));
  const [result, formAction, pending] = useActionState<AdminFormState, FormData>(saveProductAction, {});
  const errors = result.errors ?? {};
  const err = (path: string) => errors[path];

  const set = <K extends keyof EditorState>(field: K, value: EditorState[K]) => setState((s) => ({ ...s, [field]: value }));
  const updateOption = (i: number, patch: Partial<OptionRow>) =>
    set("options", state.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const payload: ProductInput = {
    ...state,
    priceTiers: stripKeys(state.priceTiers),
    bulkDiscounts: stripKeys(state.bulkDiscounts),
    options: state.options.map(({ key: _key, values, ...o }) => ({ ...o, values: stripKeys(values) })),
  };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {productId && <input type="hidden" name="id" value={productId} />}
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.entries(errors).map(([path, message]) => (
              <li key={path}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" error={err("name")}>
            <input
              className="input"
              value={state.name}
              onChange={(e) => {
                const name = e.target.value;
                setState((s) => ({ ...s, name, slug: slugTouched ? s.slug : slugify(name) }));
              }}
            />
          </Field>
          <Field label="SKU (unique product code)" error={err("sku")} hint="e.g. BC-STD-001">
            <input className="input uppercase" value={state.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
          <Field label="URL slug" error={err("slug")} hint={`/products/${state.slug || "…"}`}>
            <input
              className="input"
              value={state.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
            />
          </Field>
          <Field label="Category" error={err("categoryId")}>
            <select className="input" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Short description" error={err("summary")} hint="Shown on product cards. Up to 300 characters.">
          <input className="input" value={state.summary ?? ""} onChange={(e) => set("summary", e.target.value)} maxLength={300} />
        </Field>
        <Field label="Full description" error={err("description")}>
          <textarea className="input" rows={6} value={state.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </Section>

      <Section title="Pricing and quantities" description="Enter amounts in rupees (PKR). Prices are recalculated on the server for every order.">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Base price per unit (PKR)" error={err("basePrice")}>
            <input className="input" inputMode="decimal" value={String(state.basePrice)} onChange={(e) => set("basePrice", e.target.value)} />
          </Field>
          <Field label="Minimum quantity" error={err("minQuantity")}>
            <input className="input" type="number" min={1} value={String(state.minQuantity)} onChange={(e) => set("minQuantity", e.target.value)} />
          </Field>
          <Field label="Quantity step" error={err("quantityStep")} hint="e.g. 100 = 100, 200, 300…">
            <input className="input" type="number" min={1} value={String(state.quantityStep)} onChange={(e) => set("quantityStep", e.target.value)} />
          </Field>
          <Field label="Production time (working days)" error={err("turnaroundDays")}>
            <input className="input" type="number" min={0} value={String(state.turnaroundDays)} onChange={(e) => set("turnaroundDays", e.target.value)} />
          </Field>
        </div>

        <ListEditor
          title="Quantity pricing tiers"
          hint="From this quantity, the base unit price becomes the tier price."
          addLabel="Add tier"
          onAdd={() => set("priceTiers", [...state.priceTiers, { key: key(), minQuantity: "", unitPrice: "" }])}
        >
          {state.priceTiers.map((tier, i) => (
            <div key={tier.key} className="flex flex-wrap items-start gap-2">
              <Field label="From quantity" error={err(`priceTiers.${i}.minQuantity`)} compact>
                <input
                  className="input w-32"
                  type="number"
                  value={String(tier.minQuantity)}
                  onChange={(e) => set("priceTiers", state.priceTiers.map((t, j) => (j === i ? { ...t, minQuantity: e.target.value } : t)))}
                />
              </Field>
              <Field label="Unit price (PKR)" error={err(`priceTiers.${i}.unitPrice`)} compact>
                <input
                  className="input w-32"
                  inputMode="decimal"
                  value={String(tier.unitPrice)}
                  onChange={(e) => set("priceTiers", state.priceTiers.map((t, j) => (j === i ? { ...t, unitPrice: e.target.value } : t)))}
                />
              </Field>
              <RemoveButton onClick={() => set("priceTiers", state.priceTiers.filter((_, j) => j !== i))} label="Remove tier" />
            </div>
          ))}
        </ListEditor>

        <ListEditor
          title="Bulk discounts"
          hint="Percentage off the printed units (not one-time fees) from this quantity."
          addLabel="Add discount"
          onAdd={() => set("bulkDiscounts", [...state.bulkDiscounts, { key: key(), minQuantity: "", percent: "" }])}
        >
          {state.bulkDiscounts.map((d, i) => (
            <div key={d.key} className="flex flex-wrap items-start gap-2">
              <Field label="From quantity" error={err(`bulkDiscounts.${i}.minQuantity`)} compact>
                <input
                  className="input w-32"
                  type="number"
                  value={String(d.minQuantity)}
                  onChange={(e) => set("bulkDiscounts", state.bulkDiscounts.map((x, j) => (j === i ? { ...x, minQuantity: e.target.value } : x)))}
                />
              </Field>
              <Field label="Discount %" error={err(`bulkDiscounts.${i}.percent`)} compact>
                <input
                  className="input w-24"
                  inputMode="decimal"
                  value={d.percent}
                  onChange={(e) => set("bulkDiscounts", state.bulkDiscounts.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))}
                />
              </Field>
              <RemoveButton onClick={() => set("bulkDiscounts", state.bulkDiscounts.filter((_, j) => j !== i))} label="Remove discount" />
            </div>
          ))}
        </ListEditor>
      </Section>

      <Section
        title="Options and variations"
        description="Sizes, materials, finishing and other choices. Each value can add a price per unit or a one-time fee per order (e.g. die or plate setup)."
      >
        {state.options.map((option, i) => (
          <fieldset key={option.key} className="rounded-lg border border-border p-4">
            <legend className="sr-only">Option {i + 1}</legend>
            <div className="flex flex-wrap items-start gap-2">
              <Field label="Option name" error={err(`options.${i}.name`)} compact>
                <input className="input w-48" value={option.name} onChange={(e) => updateOption(i, { name: e.target.value })} placeholder="e.g. Paper" />
              </Field>
              <Field label="Type" compact>
                <select className="input w-36" value={option.kind} onChange={(e) => updateOption(i, { kind: e.target.value as OptionRow["kind"] })}>
                  {OPTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="ml-auto flex gap-1 pt-6">
                <IconButton label="Move option up" disabled={i === 0} onClick={() => set("options", move(state.options, i, i - 1))}>↑</IconButton>
                <IconButton label="Move option down" disabled={i === state.options.length - 1} onClick={() => set("options", move(state.options, i, i + 1))}>↓</IconButton>
                <RemoveButton onClick={() => set("options", state.options.filter((_, j) => j !== i))} label="Remove option" />
              </div>
            </div>
            {err(`options.${i}.values`) && <p className="field-error">{err(`options.${i}.values`)}</p>}
            <div className="mt-3 space-y-2">
              {option.values.map((value, vi) => {
                const updateValue = (patch: Partial<typeof value>) =>
                  updateOption(i, { values: option.values.map((v, j) => (j === vi ? { ...v, ...patch } : v)) });
                return (
                  <div key={value.key} className="flex flex-wrap items-start gap-2 pl-2">
                    <Field label="Value" error={err(`options.${i}.values.${vi}.label`)} compact>
                      <input className="input w-48" value={value.label} onChange={(e) => updateValue({ label: e.target.value })} placeholder="e.g. 400gsm Gloss" />
                    </Field>
                    <Field label="Extra (PKR)" error={err(`options.${i}.values.${vi}.priceDelta`)} compact>
                      <input className="input w-28" inputMode="decimal" value={String(value.priceDelta)} onChange={(e) => updateValue({ priceDelta: e.target.value })} />
                    </Field>
                    <Field label="Charged" compact>
                      <select className="input w-36" value={value.pricing} onChange={(e) => updateValue({ pricing: e.target.value as typeof value.pricing })}>
                        <option value="PER_UNIT">per unit</option>
                        <option value="PER_ORDER">once per order</option>
                      </select>
                    </Field>
                    <div className="flex gap-1 pt-6">
                      <IconButton label="Move value up" disabled={vi === 0} onClick={() => updateOption(i, { values: move(option.values, vi, vi - 1) })}>↑</IconButton>
                      <RemoveButton onClick={() => updateOption(i, { values: option.values.filter((_, j) => j !== vi) })} label="Remove value" />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="text-sm font-semibold text-brand"
                onClick={() => updateOption(i, { values: [...option.values, { key: key(), label: "", priceDelta: "0", pricing: "PER_UNIT" }] })}
              >
                + Add value
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            set("options", [
              ...state.options,
              { key: key(), name: "", kind: "OTHER", values: [{ key: key(), label: "", priceDelta: "0", pricing: "PER_UNIT" }] },
            ])
          }
        >
          Add option
        </button>
      </Section>

      <Section title="Visibility and marketing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publication status" error={err("status")} hint={imageCount === 0 ? "Upload at least one image before publishing." : undefined}>
            <select className="input" value={state.status} onChange={(e) => set("status", e.target.value as EditorState["status"])}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published (visible in store)</option>
              <option value="ARCHIVED">Archived (hidden, kept for history)</option>
            </select>
          </Field>
          <Field label="Affiliate commission %" error={err("affiliateCommission")} hint="Leave empty to use the affiliate program default.">
            <input className="input" inputMode="decimal" value={state.affiliateCommission} onChange={(e) => set("affiliateCommission", e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Check label="Available to order" checked={state.isAvailable} onChange={(v) => set("isAvailable", v)} />
          <Check label="Featured on home page" checked={state.isFeatured} onChange={(v) => set("isFeatured", v)} />
          <Check label="Offer design service" checked={state.allowsDesignService} onChange={(v) => set("allowsDesignService", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title" error={err("seoTitle")} hint={`${(state.seoTitle ?? "").length}/70 · defaults to the product name`}>
            <input className="input" value={state.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} />
          </Field>
          <Field label="SEO description" error={err("seoDescription")} hint={`${(state.seoDescription ?? "").length}/160 · defaults to the short description`}>
            <input className="input" value={state.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} maxLength={160} />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </button>
        {!productId && <span className="text-sm text-muted">You can upload images after creating the product.</span>}
      </div>
    </form>
  );
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; compact?: boolean; children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>> }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": note ? noteId : undefined,
      })}
      {note && (
        <p id={noteId} className={error ? "field-error" : "mt-1 text-xs text-muted"}>
          {note}
        </p>
      )}
    </div>
  );
}

function ListEditor({ title, hint, addLabel, onAdd, children }: { title: string; hint: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      {children}
      <button type="button" className="text-sm font-semibold text-brand" onClick={onAdd}>
        + {addLabel}
      </button>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded border border-border px-2 py-1.5 text-sm disabled:opacity-30">
      {children}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="mt-6 rounded border border-border px-2 py-1.5 text-sm text-red-600 hover:border-red-400">
      ✕
    </button>
  );
}
