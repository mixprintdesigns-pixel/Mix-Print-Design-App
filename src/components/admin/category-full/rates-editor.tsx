"use client";

import { useRouter } from "next/navigation";
import { removeRateQualityImageAction, uploadRateQualityImageAction } from "@/app/admin/categories/full-actions";
import { prepareBlogImage } from "@/components/admin/blog/prepare-image";
import type { CategoryFullPayload } from "@/lib/admin/category-full";

// The Rates & Calculator part of "Edit all settings": sections (blue title bar + pricing rule), their rows /
// sticker types / qualities, and every button with its rate and (optional) own pricing rule. Nothing here is
// saved until the one Save button at the bottom of the page.

export type RatesState = NonNullable<CategoryFullPayload["rates"]>;
export type SectionState = RatesState["sections"][number];
export type GroupState = SectionState["groups"][number];
export type ButtonState = GroupState["buttons"][number];
type Kind = SectionState["kind"];

let counter = 0;
export const tempId = () => `new:${Date.now().toString(36)}${(counter++).toString(36)}`;

export const KIND_LABELS: Record<Kind, string> = {
  FLEX: "Flex / Backlit Flex: each side to the next full foot",
  STICKER: "Sticker: 4.5 ft media roll rules",
  SIGN_BOARD: "Sign Board: each side to the next full foot, one rate per quality",
};
const RULE_SHORT: Record<Kind, string> = { FLEX: "Flex", STICKER: "Sticker", SIGN_BOARD: "Sign Board" };
const GROUP_WORD: Record<Kind, string> = { FLEX: "button row", STICKER: "sticker type", SIGN_BOARD: "quality" };

export function newSection(kind: Kind, categoryId: string, sortOrder: number): SectionState {
  return {
    id: tempId(),
    title: "",
    kind,
    isVisible: true,
    sortOrder,
    remove: false,
    commission: kind === "FLEX" ? "5" : kind === "STICKER" ? "10" : "50",
    bonusSlabs: [],
    hasFitting: false,
    fittingRate: "0",
    askDesignCode: false,
    showOn: kind === "SIGN_BOARD" ? [categoryId] : [],
    groups: [],
  };
}

const newGroup = (sortOrder: number): GroupState => ({
  id: tempId(),
  name: "",
  subtitle: "",
  description: "",
  imageAlt: "",
  rate: "",
  isVisible: true,
  sortOrder,
  featureIds: [],
  remove: false,
  buttons: [],
});
const newButton = (sortOrder: number): ButtonState => ({ id: tempId(), label: "", rate: "", rule: null, isVisible: true, sortOrder, remove: false });

export function RatesEditor({
  rates,
  setRates,
  features,
  rateChoices,
  linked,
  categoryId,
  qualityImages = {},
  onResult,
}: {
  qualityImages?: Record<string, string | null>;
  onResult?: (r: { error?: string; message?: string }) => void;
  rates: RatesState;
  setRates: (fn: (r: RatesState) => RatesState) => void;
  features: { id: string; label: string; remove: boolean }[];
  rateChoices: { id: string; label: string }[];
  linked: { id: string; title: string; categoryId: string | null; owner: string }[];
  categoryId: string;
}) {
  const router = useRouter();
  const setSection = (si: number, fn: (s: SectionState) => SectionState) => setRates((r) => ({ ...r, sections: r.sections.map((s, i) => (i === si ? fn(s) : s)) }));
  const setGroup = (si: number, gi: number, fn: (g: GroupState) => GroupState) => setSection(si, (s) => ({ ...s, groups: s.groups.map((g, i) => (i === gi ? fn(g) : g)) }));
  const setButton = (si: number, gi: number, bi: number, fn: (b: ButtonState) => ButtonState) =>
    setGroup(si, gi, (g) => ({ ...g, buttons: g.buttons.map((b, i) => (i === bi ? fn(b) : b)) }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" checked={rates.enabled} onChange={(e) => setRates((r) => ({ ...r, enabled: e.target.checked }))} /> Show rate calculator on the website
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Page title with rates (H1)</span>
          <input className="input" value={rates.title} maxLength={160} onChange={(e) => setRates((r) => ({ ...r, title: e.target.value }))} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Intro above the rates (optional)</span>
          <textarea className="input min-h-16" value={rates.intro} maxLength={1000} onChange={(e) => setRates((r) => ({ ...r, intro: e.target.value }))} />
        </label>
      </div>

      {linked.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/30">
          <p className="font-semibold">Also shown on this page (set on another page):</p>
          <ul className="mt-1 list-disc pl-5">
            {linked.map((l) => (
              <li key={l.id}>
                {l.title} — from {l.owner}
                {l.categoryId && (
                  <>
                    {" "}
                    <a href={`/admin/categories/${l.categoryId}#rates`} className="font-semibold text-brand">
                      edit there →
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rates.sections.map((s, si) => (
        <section key={s.id} className={`rounded-xl border p-4 ${s.remove ? "border-red-300 bg-red-50/50 opacity-70 dark:bg-red-950/20" : "border-border bg-background/50"}`} data-testid="full-section" aria-label={s.title || "New section"}>
          <p className="rounded-lg bg-gradient-to-r from-sky-700 to-cyan-600 px-4 py-2 text-center font-bold text-white">{s.title || "New section"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_2fr_6rem_auto]">
            <label className="block">
              <span className="label">Section title</span>
              <input className="input" value={s.title} maxLength={120} placeholder="e.g. Flex GSM & Rate per sq ft (Rs)" onChange={(e) => setSection(si, (x) => ({ ...x, title: e.target.value }))} />
            </label>
            <label className="block">
              <span className="label">Pricing rule</span>
              <select className="input" value={s.kind} onChange={(e) => setSection(si, (x) => ({ ...x, kind: e.target.value as Kind }))}>
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Order</span>
              <input type="number" className="input" value={s.sortOrder} onChange={(e) => setSection(si, (x) => ({ ...x, sortOrder: Number(e.target.value) || 0 }))} />
            </label>
            <div className="flex items-end gap-3 pb-2 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={s.isVisible} onChange={(e) => setSection(si, (x) => ({ ...x, isVisible: e.target.checked }))} /> Show
              </label>
              <label className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                <input type="checkbox" checked={s.remove} onChange={(e) => setSection(si, (x) => ({ ...x, remove: e.target.checked }))} /> Delete section
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.hasFitting} onChange={(e) => setSection(si, (x) => ({ ...x, hasFitting: e.target.checked }))} /> Fitting charges (3D Wallpaper)
              {s.hasFitting && (
                <span className="flex items-center gap-1">
                  Rs
                  <input className="input w-24 py-1" inputMode="decimal" value={s.fittingRate} aria-label="Fitting charges per sq ft" onChange={(e) => setSection(si, (x) => ({ ...x, fittingRate: e.target.value }))} /> per sq ft
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.askDesignCode} onChange={(e) => setSection(si, (x) => ({ ...x, askDesignCode: e.target.checked }))} /> Ask for a design code (3D Wallpaper gallery)
            </label>
          </div>

          <details className="mt-3 rounded-lg border border-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-semibold">Also show this section on… ({s.showOn.length} page{s.showOn.length === 1 ? "" : "s"}, with the pages inside them)</summary>
            <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
              {rateChoices.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.showOn.includes(c.id)}
                    onChange={(e) => setSection(si, (x) => ({ ...x, showOn: e.target.checked ? [...x.showOn, c.id] : x.showOn.filter((y) => y !== c.id) }))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </details>

          <div className="mt-4 space-y-3">
            {s.groups.map((g, gi) => (
              <div key={g.id} className={`rounded-lg border p-3 ${g.remove ? "border-red-300 opacity-60" : "border-border bg-surface"}`} data-testid="full-group">
                <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_6rem_auto]">
                  <label className="block">
                    <span className="label">
                      {s.kind === "SIGN_BOARD" ? "Quality name" : s.kind === "STICKER" ? "Sticker type (column title)" : gi === 0 ? "Row name (first row: sits under the title bar)" : "Bar title (e.g. Most Famous Flex Names)"}
                    </span>
                    <input className="input" value={g.name} maxLength={120} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, name: e.target.value }))} />
                  </label>
                  {s.kind === "SIGN_BOARD" ? (
                    <label className="block">
                      <span className="label">Button text (Normal / Medium / Premium)</span>
                      <input className="input" value={g.subtitle} maxLength={80} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, subtitle: e.target.value }))} />
                    </label>
                  ) : (
                    <span />
                  )}
                  <label className="block">
                    <span className="label">Order</span>
                    <input type="number" className="input" value={g.sortOrder} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, sortOrder: Number(e.target.value) || 0 }))} />
                  </label>
                  <div className="flex items-end gap-3 pb-2 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={g.isVisible} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, isVisible: e.target.checked }))} /> Show
                    </label>
                    <label className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <input type="checkbox" checked={g.remove} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, remove: e.target.checked }))} /> Delete
                    </label>
                  </div>
                </div>

                {s.kind === "SIGN_BOARD" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <label className="block">
                      <span className="label">Rate per sq ft (Rs)</span>
                      <input className="input" inputMode="decimal" value={g.rate} placeholder="keep" aria-label={`Rate per sq ft for ${g.name || "quality"}`} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, rate: e.target.value }))} />
                    </label>
                    <fieldset>
                      <legend className="label">Features ✓ (ticked = included; the others show greyed out)</legend>
                      <div className="flex flex-wrap gap-2">
                        {features.filter((f) => !f.remove && f.label.trim()).map((f) => (
                          <label key={f.id} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={g.featureIds.includes(f.id)}
                              onChange={(e) => setGroup(si, gi, (x) => ({ ...x, featureIds: e.target.checked ? [...x.featureIds, f.id] : x.featureIds.filter((y) => y !== f.id) }))}
                            />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block sm:col-span-2">
                      <span className="label">Description</span>
                      <textarea className="input min-h-20" value={g.description} maxLength={5000} onChange={(e) => setGroup(si, gi, (x) => ({ ...x, description: e.target.value }))} />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
                      <span className="label mb-0">Image (optional)</span>
                      {qualityImages[g.id] && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin preview
                        <img src={qualityImages[g.id]!} alt="" className="h-12 w-20 rounded object-cover" />
                      )}
                      {g.id.startsWith("new:") ? (
                        <span className="text-xs text-muted">Save first, then add an image.</span>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="input max-w-xs py-1"
                            aria-label={`Image for ${g.name}`}
                            onChange={async (e) => {
                              const file = e.currentTarget.files?.[0];
                              if (!file) return;
                              const fd = new FormData();
                              fd.set("id", g.id);
                              fd.set("image", await prepareBlogImage(file, "inline"));
                              onResult?.(await uploadRateQualityImageAction(fd));
                              router.refresh();
                            }}
                          />
                          {qualityImages[g.id] && (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700"
                              onClick={async () => {
                                onResult?.(await removeRateQualityImageAction(g.id));
                                router.refresh();
                              }}
                            >
                              Remove image
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="py-1 pr-2">Button text (e.g. {s.kind === "STICKER" ? "1000 Series" : gi === 0 ? "240 GSM" : "China Flex 240 GSM"})</th>
                          <th className="py-1 pr-2">Rate (Rs)</th>
                          <th className="py-1 pr-2">Pricing rule</th>
                          <th className="py-1 pr-2">Order</th>
                          <th className="py-1 pr-2">Show</th>
                          <th className="py-1">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.buttons.map((b, bi) => (
                          <tr key={b.id} className={b.remove ? "opacity-50" : ""}>
                            <td className="py-1 pr-2">
                              <input className="input" value={b.label} maxLength={60} aria-label={`${g.name || "Row"} button ${bi + 1} text`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, label: e.target.value }))} />
                            </td>
                            <td className="py-1 pr-2">
                              <input className="input w-24" inputMode="decimal" value={b.rate} placeholder={b.id.startsWith("new:") ? "0" : "keep"} aria-label={`${g.name || "Row"} button ${bi + 1} rate`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, rate: e.target.value }))} />
                            </td>
                            <td className="py-1 pr-2">
                              <select className="input w-36" value={b.rule ?? ""} aria-label={`${g.name || "Row"} button ${bi + 1} pricing rule`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, rule: (e.target.value || null) as Kind | null }))}>
                                <option value="">Section rule ({RULE_SHORT[s.kind]})</option>
                                <option value="FLEX">Flex</option>
                                <option value="STICKER">Sticker</option>
                                <option value="SIGN_BOARD">Sign Board</option>
                              </select>
                            </td>
                            <td className="py-1 pr-2">
                              <input type="number" className="input w-20" value={b.sortOrder} aria-label={`${g.name || "Row"} button ${bi + 1} order`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, sortOrder: Number(e.target.value) || 0 }))} />
                            </td>
                            <td className="py-1 pr-2 text-center">
                              <input type="checkbox" checked={b.isVisible} aria-label={`Show ${g.name || "row"} button ${bi + 1}`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, isVisible: e.target.checked }))} />
                            </td>
                            <td className="py-1 text-center">
                              <input type="checkbox" checked={b.remove} aria-label={`Delete ${g.name || "row"} button ${bi + 1}`} onChange={(e) => setButton(si, gi, bi, (x) => ({ ...x, remove: e.target.checked }))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" className="btn-secondary mt-2 px-3 py-1.5 text-xs" onClick={() => setGroup(si, gi, (x) => ({ ...x, buttons: [...x.buttons, newButton((x.buttons.at(-1)?.sortOrder ?? -1) + 1)] }))}>
                      + Add a button to {g.name || `this ${GROUP_WORD[s.kind]}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setSection(si, (x) => ({ ...x, groups: [...x.groups, newGroup((x.groups.at(-1)?.sortOrder ?? -1) + 1)] }))}>
              + Add a {GROUP_WORD[s.kind]}
            </button>
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Add a section:</span>
        {(["FLEX", "STICKER", "SIGN_BOARD"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            className="btn-secondary px-3 py-1.5 text-sm"
            onClick={() => setRates((r) => ({ ...r, sections: [...r.sections, newSection(k, categoryId, (r.sections.at(-1)?.sortOrder ?? -1) + 1)] }))}
          >
            + {RULE_SHORT[k]} section
          </button>
        ))}
      </div>
    </div>
  );
}

/** Commission per billable sq ft and big-order bonus slabs, per section. */
export function CommissionEditor({ rates, setRates }: { rates: RatesState; setRates: (fn: (r: RatesState) => RatesState) => void }) {
  const setSection = (si: number, fn: (s: SectionState) => SectionState) => setRates((r) => ({ ...r, sections: r.sections.map((s, i) => (i === si ? fn(s) : s)) }));
  const live = rates.sections.map((s, i) => ({ s, i })).filter(({ s }) => !s.remove);
  if (live.length === 0) return <p className="text-sm text-muted">Add a rate section first.</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Affiliates earn a fixed amount per billable sq ft (after the rounding rules), never on designing charges, and always in full, even with a discount. Pending when the order is saved, Approved when it is paid, cancelled with the order.
      </p>
      {live.map(({ s, i }) => (
        <div key={s.id} className="rounded-lg border border-border p-3" data-testid="commission-section">
          <p className="font-semibold">{s.title || "New section"}</p>
          <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            Commission Rs
            <input className="input w-24 py-1" inputMode="decimal" value={s.commission} aria-label={`Commission per sq ft for ${s.title}`} onChange={(e) => setSection(i, (x) => ({ ...x, commission: e.target.value }))} />
            per billable sq ft
          </label>
          <p className="mt-3 text-sm font-semibold">Big-order bonus (optional)</p>
          {s.bonusSlabs.map((b, bi) => (
            <div key={bi} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              If billable sq ft ≥
              <input className="input w-24 py-1" inputMode="numeric" value={b.minSqft} aria-label={`Bonus ${bi + 1} sq ft`} onChange={(e) => setSection(i, (x) => ({ ...x, bonusSlabs: x.bonusSlabs.map((y, j) => (j === bi ? { ...y, minSqft: e.target.value } : y)) }))} />→ one-time bonus Rs
              <input className="input w-28 py-1" inputMode="decimal" value={b.bonus} aria-label={`Bonus ${bi + 1} amount`} onChange={(e) => setSection(i, (x) => ({ ...x, bonusSlabs: x.bonusSlabs.map((y, j) => (j === bi ? { ...y, bonus: e.target.value } : y)) }))} />
              <button type="button" className="text-xs font-semibold text-red-700" onClick={() => setSection(i, (x) => ({ ...x, bonusSlabs: x.bonusSlabs.filter((_, j) => j !== bi) }))}>
                Delete
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary mt-2 px-3 py-1 text-xs" onClick={() => setSection(i, (x) => ({ ...x, bonusSlabs: [...x.bonusSlabs, { minSqft: "", bonus: "" }] }))}>
            + Add a bonus slab
          </button>
          <p className="mt-1 text-xs text-muted">One bonus per order: the highest slab reached, added to the commission as its own line.</p>
        </div>
      ))}
    </div>
  );
}
