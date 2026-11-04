import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { listRatePages, rateServiceChoices, readRateSettings } from "@/lib/rates/admin";
import { formatRs } from "@/lib/rates/calculator";
import { publicItems } from "@/lib/rates/visibility";
import { paisaToRupeesInput } from "@/lib/admin/product-input";
import { createRatePageAction, saveRateSettingsAction } from "../rates-actions";

export const metadata = { title: "Rates" };

export default async function AdminRatesPage() {
  await requireStaff(["ADMIN"]);
  const [pages, choices, settings] = await Promise.all([listRatePages(), rateServiceChoices(), readRateSettings()]);
  const taken = new Set(pages.map((p) => p.categoryId));
  const free = choices.filter((c) => !taken.has(c.id));

  return (
    <>
      <h1 className="text-2xl font-bold">Rates</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Prices per square foot with a size calculator, for sign boards (Backlit, Front-lit and any board type) and Digital Printing (flex and stickers).
        Each rate page appears on its service page. Open a page to add or edit its items: name, sub-title, description, image and rate (or a rate for
        each GSM / series). Items and options with rate 0, or hidden, are not shown. Customers see the price live and order through the normal Order now
        flow (saved with the affiliate, then WhatsApp).
      </p>

      <section className="mt-6" aria-labelledby="rate-pages-heading">
        <h2 id="rate-pages-heading" className="text-lg font-bold">
          Rate pages
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Page title (H1)</th>
                <th className="px-4 py-2">Shown on</th>
                <th className="px-4 py-2">Items on the website</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((p) => (
                <tr key={p.id} data-testid="rate-page-row">
                  <td className="px-4 py-3 font-medium">
                    {p.title}
                    {!p.isVisible && <span className="ml-2 text-xs text-amber-700">(hidden)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.category ? (
                      <Link href={`/services/${p.category.path.join("/")}`} className="text-brand hover:underline" target="_blank">
                        {p.category.name}
                      </Link>
                    ) : (
                      <span className="text-muted">Not linked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {publicItems(p.items).length} of {p.items.length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/rates/${p.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {pages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    No rate pages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-8 p-5" aria-labelledby="new-rate-page-heading">
        <h2 id="new-rate-page-heading" className="text-lg font-bold">
          Add a rate page
        </h2>
        <p className="mt-1 text-sm text-muted">Put rates on an existing service page, or type the name of a new board type to create its page under Sign Board Maker.</p>
        <ActionForm action={createRatePageAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Existing service page</span>
            <select name="categoryId" className="input" defaultValue="">
              <option value="">Choose…</option>
              {free.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">…or a new board type (e.g. Neon Sign Board)</span>
            <input name="newBoardName" className="input" maxLength={100} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Page title (H1, optional)</span>
            <input name="title" className="input" maxLength={160} placeholder="e.g. Neon Sign Board Price per Sq Ft in Lahore" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Add rate page</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card mt-8 p-5" aria-labelledby="rate-settings-heading">
        <h2 id="rate-settings-heading" className="text-lg font-bold">
          Charges and options
        </h2>
        <ActionForm action={saveRateSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Design charges (Rs, added to every order from these pages)</span>
            <input name="designCharge" className="input" inputMode="decimal" defaultValue={paisaToRupeesInput(settings.designChargeMinor)} required />
            <span className="mt-1 block text-xs text-muted">Shown as its own line. Customers cannot remove or change it. Now: {formatRs(settings.designChargeMinor)}.</span>
          </label>
          <label className="block">
            <span className="label">Minimum printing cost (Rs, optional)</span>
            <input name="minOrder" className="input" inputMode="decimal" defaultValue={settings.minOrderMinor ? paisaToRupeesInput(settings.minOrderMinor) : ""} placeholder="No minimum" />
            <span className="mt-1 block text-xs text-muted">If the size × rate comes to less, this amount is charged for printing instead.</span>
          </label>
          <label className="block">
            <span className="label">GSM options (for flex), separated by commas</span>
            <input name="gsmOptions" className="input" defaultValue={settings.gsmOptions.join(", ")} />
          </label>
          <label className="block">
            <span className="label">Series options (for stickers), one per line</span>
            <textarea name="seriesOptions" className="input min-h-24" defaultValue={settings.seriesOptions.join("\n")} />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Save charges and options</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
