import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { RateGroupEditor } from "@/components/admin/rates/rate-group-editor";
import { paisaToRupeesInput } from "@/lib/admin/product-input";
import { requireStaff } from "@/lib/auth/session";
import { getRatePageForAdmin, readRateFeatures } from "@/lib/rates/admin";
import { RULE_LABELS } from "@/lib/rates/calculator";
import { publicGroup } from "@/lib/rates/visibility";
import { addRateGroupAction, addRateSectionAction, deleteRateSectionAction, saveRatePageAction, saveRateSectionAction } from "../../rates-actions";

export const metadata = { title: "Edit rate page" };

const KIND_OPTIONS = [
  { value: "FLEX", label: `Flex / Backlit Flex: ${RULE_LABELS.FLEX}` },
  { value: "STICKER", label: `Stickers: ${RULE_LABELS.STICKER}` },
  { value: "SIGN_BOARD", label: `Sign Board: ${RULE_LABELS.SIGN_BOARD}` },
] as const;

const ADD_WHAT = { FLEX: "Add a button row", STICKER: "Add a sticker type", SIGN_BOARD: "Add a quality" } as const;
const ADD_PLACEHOLDER = { FLEX: "e.g. Most Famous Flex Names", STICKER: "e.g. Vinyl", SIGN_BOARD: "e.g. Premium Backlit Sign Board" } as const;

export default async function AdminRatePage({ params, searchParams }: PageProps<"/admin/rates/[id]">) {
  await requireStaff(["ADMIN"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [page, features] = await Promise.all([getRatePageForAdmin(id), readRateFeatures()]);
  if (!page) notFound();
  const pageUrl = page.category ? `/services/${page.category.path.join("/")}` : null;

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/rates" className="font-semibold text-brand">
          ← All rate pages
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">{page.title}</h1>
      <p className="mt-1 text-sm text-muted">
        Shown on: {page.category ? page.category.name : "no service page"}
        {pageUrl && (
          <>
            {" · "}
            <Link href={pageUrl} target="_blank" className="font-semibold text-brand">
              View page ↗
            </Link>
          </>
        )}
      </p>
      {sp.created === "1" && (
        <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300" role="status">
          Rate page added. Now add its sections and rates below.
        </p>
      )}

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-lg font-bold">Page title, intro and SEO</summary>
        <ActionForm action={saveRatePageAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={page.id} />
          <label className="block sm:col-span-2">
            <span className="label">Page title (H1)</span>
            <input name="title" className="input" defaultValue={page.title} required maxLength={160} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Intro text (optional)</span>
            <textarea name="intro" className="input min-h-20" defaultValue={page.intro ?? ""} maxLength={1000} />
          </label>
          <label className="block">
            <span className="label">SEO title (optional, up to 70 characters)</span>
            <input name="seoTitle" className="input" defaultValue={page.seoTitle ?? ""} maxLength={70} />
          </label>
          <label className="block">
            <span className="label">SEO description (optional, up to 170 characters)</span>
            <input name="seoDescription" className="input" defaultValue={page.seoDescription ?? ""} maxLength={170} />
          </label>
          <label className="block">
            <span className="label">Order in the list</span>
            <input name="sortOrder" type="number" className="input" defaultValue={page.sortOrder} />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
            <input type="checkbox" name="isVisible" defaultChecked={page.isVisible} /> Show the rates on the website
          </label>
          <p className="text-xs text-muted sm:col-span-2">The title, intro and sections appear on the service page once at least one button has a rate.</p>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Save page</SubmitButton>
          </div>
        </ActionForm>
      </details>

      <h2 className="mt-8 text-lg font-bold">Sections ({page.sections.length})</h2>
      <p className="mt-1 text-sm text-muted">Each section is a blue title bar with its rate buttons and the calculator. Click a row, sticker type or quality to edit its rates.</p>

      <div className="mt-3 space-y-6">
        {page.sections.map((section) => (
          <section key={section.id} className="card space-y-4 p-4 sm:p-5" aria-label={section.title} data-testid="rate-section-editor">
            <p className="rounded-lg bg-gradient-to-r from-sky-700 to-cyan-600 px-4 py-2 text-center font-bold text-white">{section.title}</p>
            <ActionForm action={saveRateSectionAction} className="grid gap-3 sm:grid-cols-[2fr_2fr_6rem_auto_auto] sm:items-end">
              <input type="hidden" name="id" value={section.id} />
              <label className="block">
                <span className="label">Section title</span>
                <input name="title" className="input" defaultValue={section.title} required maxLength={120} />
              </label>
              <label className="block">
                <span className="label">Pricing rule</span>
                <select name="kind" className="input" defaultValue={section.kind}>
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Order</span>
                <input name="sortOrder" type="number" className="input" defaultValue={section.sortOrder} />
              </label>
              <label className="flex items-center gap-2 pb-3 text-sm font-medium">
                <input type="checkbox" name="isVisible" defaultChecked={section.isVisible} /> Show
              </label>
              <SubmitButton className="btn-primary">Save section</SubmitButton>
            </ActionForm>

            <div className="space-y-2">
              {section.items.map((item, index) => (
                <RateGroupEditor
                  key={item.id}
                  kind={section.kind}
                  index={index}
                  features={features}
                  group={{
                    id: item.id,
                    name: item.name,
                    subtitle: item.subtitle,
                    description: item.description,
                    imageUrl: item.imageUrl,
                    imageAlt: item.imageAlt,
                    rate: item.rateMinor ? paisaToRupeesInput(item.rateMinor) : "",
                    isVisible: item.isVisible,
                    sortOrder: item.sortOrder,
                    featureIds: item.featureIds,
                    buttons: item.variants.map((v) => ({ id: v.id, label: v.label, rate: v.rateMinor ? paisaToRupeesInput(v.rateMinor) : "", isVisible: v.isVisible, sortOrder: v.sortOrder })),
                    live: page.isVisible && section.isVisible && publicGroup(section.kind, item, features) !== null,
                  }}
                />
              ))}
            </div>

            <ActionForm action={addRateGroupAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="sectionId" value={section.id} />
              <label className="block min-w-56 flex-1">
                <span className="label">{ADD_WHAT[section.kind]}</span>
                <input name="name" className="input" required maxLength={120} placeholder={ADD_PLACEHOLDER[section.kind]} />
              </label>
              {section.kind === "SIGN_BOARD" && (
                <label className="block min-w-40">
                  <span className="label">Button text</span>
                  <input name="subtitle" className="input" maxLength={80} placeholder="e.g. Premium" />
                </label>
              )}
              <SubmitButton className="btn-secondary">{ADD_WHAT[section.kind]}</SubmitButton>
            </ActionForm>

            <ActionForm action={deleteRateSectionAction} confirm={`Delete the section “${section.title}” with all its buttons and rates? This cannot be undone.`}>
              <input type="hidden" name="id" value={section.id} />
              <SubmitButton className="btn border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                Delete this section
              </SubmitButton>
            </ActionForm>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-5" aria-labelledby="add-section-heading">
        <h2 id="add-section-heading" className="font-bold">
          Add a section
        </h2>
        <ActionForm action={addRateSectionAction} className="mt-3 grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
          <input type="hidden" name="pageId" value={page.id} />
          <label className="block">
            <span className="label">Section title</span>
            <input name="title" className="input" required maxLength={120} placeholder="e.g. Backlit Flex GSM & Rate per sq ft (Rs)" />
          </label>
          <label className="block">
            <span className="label">Pricing rule</span>
            <select name="kind" className="input" defaultValue="FLEX">
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton className="btn-primary">Add section</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
