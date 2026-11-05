"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { categoryCommandAction, uploadCategoryImageAction } from "@/app/admin/actions";
import { removeCategoryOgImageAction, saveCategoryFullAction, uploadCategoryGalleryAction, uploadCategoryOgImageAction } from "@/app/admin/categories/full-actions";
import { prepareBlogImage } from "@/components/admin/blog/prepare-image";
import type { CategoryFullData, CategoryFullPayload } from "@/lib/admin/category-full";
import { CommissionEditor, RatesEditor, tempId, type RatesState } from "./rates-editor";

// Admin → Categories & Services → Edit all settings: every setting of one category on one page, with one Save.
// Image uploads are saved straight away (they are files); everything else is saved with the Save button.

type Result = { error?: string; message?: string };

export function CategoryFullEditor({ data }: { data: CategoryFullData }) {
  const [message, setMessage] = useState<Result>({});
  // The form starts afresh whenever the saved data changes (after Save), with the new ids.
  return <EditorForm key={data.version} data={data} message={message} setMessage={setMessage} />;
}

function EditorForm({ data, message, setMessage }: { data: CategoryFullData; message: Result; setMessage: (r: Result) => void }) {
  const [state, setState] = useState<CategoryFullPayload>(data.editable);
  const [saving, startSaving] = useTransition();
  const cat = state.category;
  const setCat = (patch: Partial<CategoryFullPayload["category"]>) => setState((s) => ({ ...s, category: { ...s.category, ...patch } }));
  const setRates = (fn: (r: RatesState) => RatesState) => setState((s) => (s.rates ? { ...s, rates: fn(s.rates) } : s));

  function save() {
    const warnings = changesToConfirm(data.editable, state);
    if (warnings.length && !window.confirm(`Please confirm:\n\n${warnings.join("\n")}\n\nSave now?`)) return;
    setMessage({});
    startSaving(async () => {
      const result = await saveCategoryFullAction(data.id, state);
      setMessage(result);
    });
  }

  return (
    <div className="space-y-6 pb-28">
      <Panel title="Basic info" id="basic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="input" value={cat.name} maxLength={120} onChange={(e) => setCat({ name: e.target.value })} />
          </Field>
          <Field label="Order (lower first)">
            <input type="number" className="input" value={cat.sortOrder} onChange={(e) => setCat({ sortOrder: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Sub-title (short text on cards)" wide>
            <input className="input" value={cat.description} maxLength={300} onChange={(e) => setCat({ description: e.target.value })} />
          </Field>
          <Field label="Description (the page text; a blank line starts a new paragraph)" wide>
            <textarea className="input min-h-32" value={cat.content} onChange={(e) => setCat({ content: e.target.value })} />
          </Field>
          <Field label="Starting price (Rs, optional)">
            <input className="input" inputMode="decimal" value={cat.priceFrom} onChange={(e) => setCat({ priceFrom: e.target.value })} placeholder="Empty: shown from the rates or products" />
          </Field>
          <Field label="Price unit (e.g. per sq. ft)">
            <input className="input" value={cat.priceUnit} maxLength={40} onChange={(e) => setCat({ priceUnit: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={cat.isVisible} onChange={(e) => setCat({ isVisible: e.target.checked })} /> Show on the website
          </label>
        </div>
      </Panel>

      <Panel title="Images" id="images">
        <ImagesPanel data={data} state={state} setState={setState} onResult={setMessage} />
      </Panel>

      {state.rates && (
        <>
          <Panel title="Rates & Calculator" id="rates">
            <RatesEditor
              rates={state.rates}
              setRates={setRates}
              features={state.features ?? []}
              rateChoices={data.rateChoices}
              linked={data.linked}
              categoryId={data.id}
              qualityImages={data.qualityImages}
              onResult={setMessage}
            />
          </Panel>
          <Panel title="Affiliate commission" id="commission">
            <CommissionEditor rates={state.rates} setRates={setRates} />
          </Panel>
          <Panel title="Features ✓ (sign boards)" id="features">
            <FeaturesPanel features={state.features ?? []} setFeatures={(f) => setState((s) => ({ ...s, features: f }))} />
          </Panel>
        </>
      )}

      <Panel title="SEO" id="seo">
        <SeoPanel data={data} cat={cat} setCat={setCat} onResult={setMessage} />
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button type="button" className="btn-primary px-8" onClick={save} disabled={saving} data-testid="save-all">
            {saving ? "Saving…" : "Save"}
          </button>
          {message.error && (
            <span className="field-error" role="alert">
              {message.error}
            </span>
          )}
          {message.message && !saving && (
            <span className="text-sm font-medium text-green-700 dark:text-green-400" role="status">
              {message.message}
            </span>
          )}
          <span className="ml-auto text-xs text-muted">Saves everything on this page. Empty rate boxes keep their saved rate.</span>
        </div>
      </div>
    </div>
  );
}

/** Things worth a second look before saving: deletions and rates set to 0. */
function changesToConfirm(before: CategoryFullPayload, after: CategoryFullPayload): string[] {
  const out: string[] = [];
  const old = new Map<string, string>();
  for (const s of before.rates?.sections ?? []) for (const g of s.groups) {
    old.set(g.id, g.rate);
    for (const b of g.buttons) old.set(b.id, b.rate);
  }
  for (const s of after.rates?.sections ?? []) {
    if (s.remove && !s.id?.startsWith("new:")) out.push(`• Delete the section “${s.title}” with all its rates`);
    for (const g of s.groups) {
      if (g.remove && !g.id?.startsWith("new:")) out.push(`• Delete “${g.name}” and its rates`);
      const was = old.get(g.id!);
      if (s.kind === "SIGN_BOARD" && was && Number(was) > 0 && g.rate.trim() !== "" && Number(g.rate) === 0) out.push(`• Set the rate of “${g.name}” to 0`);
      for (const b of g.buttons) {
        if (b.remove && !b.id?.startsWith("new:")) out.push(`• Delete the button “${b.label}”`);
        const wasB = old.get(b.id!);
        if (wasB && Number(wasB) > 0 && b.rate.trim() !== "" && Number(b.rate) === 0) out.push(`• Set the rate of “${b.label}” to 0`);
      }
    }
  }
  for (const f of after.features ?? []) if (f.remove && !f.id?.startsWith("new:")) out.push(`• Delete the feature “${f.label}” from every quality`);
  for (const g of after.gallery) if (g.remove) out.push("• Delete a gallery image");
  return out;
}

function Panel({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-4 sm:p-5" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="mb-4 text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, wide = false, children, hint }: { label: string; wide?: boolean; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function FeaturesPanel({ features, setFeatures }: { features: NonNullable<CategoryFullPayload["features"]>; setFeatures: (f: NonNullable<CategoryFullPayload["features"]>) => void }) {
  const set = (i: number, patch: Partial<(typeof features)[number]>) => setFeatures(features.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div>
      <p className="mb-3 text-sm text-muted">One list for every sign board quality (Backlit, Front-lit, 3D…). New features appear under every quality, unticked. Tick them per quality in Rates &amp; Calculator above.</p>
      <div className="space-y-2">
        {features.map((f, i) => (
          <div key={f.id} className={`flex flex-wrap items-center gap-2 ${f.remove ? "opacity-50" : ""}`}>
            <input className="input max-w-xs" value={f.label} maxLength={80} aria-label={`Feature ${i + 1}`} onChange={(e) => set(i, { label: e.target.value })} />
            <input type="number" className="input w-20" value={f.sortOrder} aria-label={`Feature ${i + 1} order`} onChange={(e) => set(i, { sortOrder: Number(e.target.value) || 0 })} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={f.isVisible} onChange={(e) => set(i, { isVisible: e.target.checked })} /> Show
            </label>
            <label className="flex items-center gap-1 text-sm text-red-700 dark:text-red-400">
              <input type="checkbox" checked={f.remove} aria-label={`Delete feature ${i + 1}`} onChange={(e) => set(i, { remove: e.target.checked })} /> Delete
            </label>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary mt-3 px-3 py-1.5 text-sm" onClick={() => setFeatures([...features, { id: tempId(), label: "", isVisible: true, sortOrder: (features.at(-1)?.sortOrder ?? -1) + 1, remove: false }])}>
        + Add a feature
      </button>
    </div>
  );
}

function ImagesPanel({ data, state, setState, onResult }: { data: CategoryFullData; state: CategoryFullPayload; setState: (fn: (s: CategoryFullPayload) => CategoryFullPayload) => void; onResult: (r: Result) => void }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const gallery = data.images.gallery.map((img) => ({ ...img, edit: state.gallery.find((g) => g.id === img.id) ?? { id: img.id, alt: img.alt, sortOrder: img.sortOrder, remove: false } }));
  const setG = (id: string, patch: Partial<CategoryFullPayload["gallery"][number]>) =>
    setState((s) => {
      const img = data.images.gallery.find((g) => g.id === id)!;
      return { ...s, gallery: s.gallery.some((g) => g.id === id) ? s.gallery.map((g) => (g.id === id ? { ...g, ...patch } : g)) : [...s.gallery, { id, alt: img.alt, sortOrder: img.sortOrder, remove: false, ...patch }] };
    });

  async function upload(form: HTMLFormElement, action: (d: FormData) => Promise<Result>, field: string) {
    const input = form.elements.namedItem(field) as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", data.id);
    for (const f of files) fd.append(field, await prepareBlogImage(f, "inline"));
    const result = await action(fd);
    setBusy(false);
    onResult(result);
    form.reset();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
        <div>
          <p className="label">Cover image</p>
          {data.images.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={data.images.coverUrl} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" />
          ) : (
            <p className="grid aspect-[16/10] place-items-center rounded-lg border border-dashed border-border text-sm text-muted">No cover image</p>
          )}
        </div>
        <div className="space-y-3">
          <Field label="Cover image description (alt text)">
            <input className="input" value={state.category.imageAlt} maxLength={200} onChange={(e) => setState((s) => ({ ...s, category: { ...s.category, imageAlt: e.target.value } }))} />
          </Field>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-center gap-2">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input max-w-xs" aria-label="Cover image" />
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              disabled={busy}
              onClick={(e) => upload(e.currentTarget.form!, async (fd) => ((await uploadCategoryImageAction(fd)).error ? { error: "The cover image could not be uploaded." } : { message: "Cover image saved." }), "image")}
            >
              {data.images.coverUrl ? "Replace cover" : "Upload cover"}
            </button>
            {data.images.coverUrl && (
              <button
                type="button"
                className="text-sm font-semibold text-red-700"
                onClick={async () => {
                  if (!window.confirm("Remove the cover image?")) return;
                  const r = await categoryCommandAction(data.id, "remove-image");
                  onResult(r.error ? { error: r.error } : { message: "Cover image removed." });
                  router.refresh();
                }}
              >
                Remove cover
              </button>
            )}
          </form>
        </div>
      </div>

      <div>
        <p className="label">Gallery</p>
        {gallery.length === 0 && <p className="text-sm text-muted">No gallery images yet.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((g) => (
            <li key={g.id} className={`rounded-lg border border-border p-2 ${g.edit.remove ? "opacity-50" : ""}`} data-testid="gallery-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
              <img src={g.url} alt="" className="aspect-[4/3] w-full rounded object-cover" />
              <input className="input mt-2" placeholder="Alt text" value={g.edit.alt} maxLength={200} aria-label="Gallery image alt text" onChange={(e) => setG(g.id, { alt: e.target.value })} />
              <div className="mt-2 flex items-center gap-2 text-sm">
                Order <input type="number" className="input w-20 py-1" value={g.edit.sortOrder} aria-label="Gallery image order" onChange={(e) => setG(g.id, { sortOrder: Number(e.target.value) || 0 })} />
                <label className="ml-auto flex items-center gap-1 text-red-700">
                  <input type="checkbox" checked={g.edit.remove} onChange={(e) => setG(g.id, { remove: e.target.checked })} /> Delete
                </label>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" className="input max-w-xs" aria-label="Gallery images" />
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={busy} onClick={(e) => upload(e.currentTarget.form!, uploadCategoryGalleryAction, "images")}>
            {busy ? "Uploading…" : "Add to gallery"}
          </button>
          <span className="text-xs text-muted">Images upload at once; alt text, order and delete are saved with Save.</span>
        </form>
      </div>
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={value.length > max ? "font-semibold text-red-700" : ""}>{value.length} / {max} characters</span>;
}

function SeoPanel({ data, cat, setCat, onResult }: { data: CategoryFullData; cat: CategoryFullPayload["category"]; setCat: (p: Partial<CategoryFullPayload["category"]>) => void; onResult: (r: Result) => void }) {
  const router = useRouter();
  const title = cat.seoTitle || data.seoDefaults.title;
  const description = cat.seoDescription || data.seoDefaults.description;
  const url = `www.mixprintdesign.com › services › ${[...data.path.slice(0, -1), cat.slug].join(" › ")}`;
  const keyword = cat.focusKeyword.trim().toLowerCase();
  const has = (text: string) => keyword && text.toLowerCase().includes(keyword);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="grid gap-4">
        <Field label="SEO title" hint={<><Counter value={cat.seoTitle} max={60} /> · empty = “{data.seoDefaults.title}”</>}>
          <input className="input" value={cat.seoTitle} maxLength={70} placeholder={data.seoDefaults.title} onChange={(e) => setCat({ seoTitle: e.target.value })} />
        </Field>
        <Field label="Meta description" hint={<><Counter value={cat.seoDescription} max={160} /> · empty = filled from the sub-title</>}>
          <textarea className="input min-h-20" value={cat.seoDescription} maxLength={170} placeholder={data.seoDefaults.description} onChange={(e) => setCat({ seoDescription: e.target.value })} />
        </Field>
        <Field label="Focus keyword" hint={keyword ? `${has(title) ? "✓ in the title" : "✗ not in the title"} · ${has(description) ? "✓ in the description" : "✗ not in the description"}` : "e.g. flex printing in Lahore"}>
          <input className="input" value={cat.focusKeyword} maxLength={80} onChange={(e) => setCat({ focusKeyword: e.target.value })} />
        </Field>
        <Field label="URL slug" hint="Changing it changes the page address.">
          <input className="input" value={cat.slug} maxLength={80} onChange={(e) => setCat({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} />
        </Field>
        <div>
          <p className="label">Social image (Facebook, WhatsApp…; empty = the cover image)</p>
          <div className="flex flex-wrap items-center gap-3">
            {data.images.ogImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview
              <img src={data.images.ogImageUrl} alt="" className="h-16 w-32 rounded object-cover" />
            )}
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-center gap-2">
              <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input max-w-xs" aria-label="Social image" />
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-sm"
                onClick={async (e) => {
                  const form = e.currentTarget.form!;
                  const file = (form.elements.namedItem("image") as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("id", data.id);
                  fd.set("image", await prepareBlogImage(file, "cover"));
                  onResult(await uploadCategoryOgImageAction(fd));
                  form.reset();
                  router.refresh();
                }}
              >
                Upload
              </button>
              {data.images.ogImageUrl && (
                <button
                  type="button"
                  className="text-sm font-semibold text-red-700"
                  onClick={async () => {
                    onResult(await removeCategoryOgImageAction(data.id));
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
      <div>
        <p className="label">Google preview</p>
        <div className="rounded-lg border border-border bg-white p-4 text-left dark:bg-surface" data-testid="google-preview">
          <p className="truncate text-xs text-[#202124] dark:text-muted">{url}</p>
          <p className="mt-1 line-clamp-2 text-lg leading-snug text-[#1a0dab] dark:text-sky-300">{title}</p>
          <p className="mt-1 line-clamp-3 text-sm text-[#4d5156] dark:text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
