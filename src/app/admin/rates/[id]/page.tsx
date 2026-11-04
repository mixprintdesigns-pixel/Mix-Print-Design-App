import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { RateItemEditor } from "@/components/admin/rates/rate-item-editor";
import { paisaToRupeesInput } from "@/lib/admin/product-input";
import { requireStaff } from "@/lib/auth/session";
import { getRatePageForAdmin, readRateSettings, variantRows } from "@/lib/rates/admin";
import { publicItem } from "@/lib/rates/visibility";
import { addRateItemAction, saveRatePageAction } from "../../rates-actions";

export const metadata = { title: "Edit rate page" };

export default async function AdminRatePage({ params, searchParams }: PageProps<"/admin/rates/[id]">) {
  await requireStaff(["ADMIN"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [page, settings] = await Promise.all([getRatePageForAdmin(id), readRateSettings()]);
  if (!page) notFound();
  const sections = [...new Set(page.items.map((i) => i.section).filter((s): s is string => !!s))];
  const pageUrl = page.category ? `/services/${page.category.path.join("/")}` : null;
  const rows = (type: "GSM" | "SERIES", variants: (typeof page.items)[number]["variants"]) =>
    variantRows(type, settings, variants).map((r) => ({ label: r.label, rate: r.rateMinor ? paisaToRupeesInput(r.rateMinor) : "", isVisible: r.isVisible }));

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
          Rate page added. Now add its items below.
        </p>
      )}

      <section className="card mt-6 p-5" aria-labelledby="page-settings-heading">
        <h2 id="page-settings-heading" className="text-lg font-bold">
          Page
        </h2>
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
          <p className="text-xs text-muted sm:col-span-2">The title, intro and rates appear on the service page once at least one item has a rate.</p>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Save page</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="mt-8" aria-labelledby="items-heading">
        <h2 id="items-heading" className="text-lg font-bold">
          Items ({page.items.length})
        </h2>
        <p className="mt-1 text-sm text-muted">Click an item to edit it. Items are never deleted: untick “Show on the website” to hide one.</p>
        <div className="mt-3 space-y-3">
          {page.items.map((item) => (
            <RateItemEditor
              key={item.id}
              sections={sections}
              item={{
                id: item.id,
                section: item.section,
                name: item.name,
                subtitle: item.subtitle,
                description: item.description,
                imageUrl: item.imageUrl,
                imageAlt: item.imageAlt,
                rate: item.rateMinor ? paisaToRupeesInput(item.rateMinor) : "",
                variantType: item.variantType,
                isVisible: item.isVisible,
                sortOrder: item.sortOrder,
                live: page.isVisible && publicItem(item) !== null,
              }}
              gsmRows={rows("GSM", item.variants)}
              seriesRows={rows("SERIES", item.variants)}
            />
          ))}
        </div>

        <div className="card mt-6 p-5">
          <h3 className="font-bold">Add an item</h3>
          <ActionForm action={addRateItemAction} className="mt-3 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="pageId" value={page.id} />
            <label className="block">
              <span className="label">Name (H2 title)</span>
              <input name="name" className="input" required maxLength={120} placeholder="e.g. Premium Backlit Sign Board" />
            </label>
            <label className="block">
              <span className="label">Sub-title (optional)</span>
              <input name="subtitle" className="input" maxLength={80} placeholder="e.g. Premium" />
            </label>
            <label className="block">
              <span className="label">Section (optional)</span>
              <input name="section" className="input" maxLength={60} list="new-item-sections" placeholder="e.g. Flex" />
              <datalist id="new-item-sections">
                {sections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Price by</span>
              <select name="variantType" className="input" defaultValue="NONE">
                <option value="NONE">One rate per sq ft</option>
                <option value="GSM">GSM options (flex)</option>
                <option value="SERIES">Series options (stickers)</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-primary">Add item</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
