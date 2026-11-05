import { CategoryManager } from "@/components/admin/category-manager";
import { categoryChoices } from "@/lib/admin/editor-data";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { saveRateSettingsAction } from "@/app/admin/rates-actions";
import { readRateSettings } from "@/lib/rates/queries";
import { paisaToRupeesInput } from "@/lib/admin/product-input";

// AI image generation can take up to a minute.
export const maxDuration = 120;

export const metadata = { title: "Categories & Services" };

export default async function AdminCategoriesPage() {
  await requireStaff(["ADMIN"]);
  const [categories, rateSettings] = await Promise.all([categoryChoices(), readRateSettings()]);
  return (
    <>
      <h1 className="text-2xl font-bold">Categories &amp; Services</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        One tree for both the Services and Products pages: Main service → Category → Sub-category (add as many levels as you need).
        Products assigned to any category appear there automatically on both pages. Hidden categories (and everything inside them)
        are not shown on the website.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Click <strong>All settings</strong> on any row for one page with everything: basic info, images and gallery, SEO, and for Digital Printing and Sign
        Board Maker the rates &amp; calculator, affiliate commission and features ✓.
      </p>
      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>

      <section className="card mt-8 p-5" aria-labelledby="calc-settings-heading">
        <h2 id="calc-settings-heading" className="text-lg font-bold">
          Calculator settings (all rate sections)
        </h2>
        <ActionForm action={saveRateSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Designing charges (Rs, added to every calculator order)</span>
            <input name="designCharge" className="input" inputMode="decimal" defaultValue={paisaToRupeesInput(rateSettings.designChargeMinor)} required />
            <span className="mt-1 block text-xs text-muted">Shown as its own line; customers cannot change or remove it. Earns no affiliate commission.</span>
          </label>
          <label className="block">
            <span className="label">Minimum printing cost (Rs, optional)</span>
            <input name="minOrder" className="input" inputMode="decimal" defaultValue={rateSettings.minOrderMinor ? paisaToRupeesInput(rateSettings.minOrderMinor) : ""} placeholder="No minimum" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Save calculator settings</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
