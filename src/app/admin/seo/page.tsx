import { saveSeoPagesAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { getSeoPages, SEO_PAGES, type SeoPageKey } from "@/lib/content/seo-pages";
import { SITE_URL } from "@/lib/seo";

export const metadata = { title: "SEO" };

export default async function AdminSeoPage() {
  await requireStaff(["ADMIN"]);
  const saved = await getSeoPages();
  return (
    <>
      <h1 className="text-2xl font-bold">SEO</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        The title and description Google shows for the main pages. Leave a field empty to use the default shown in grey. Categories,
        services and products have their own SEO fields on their edit forms.
      </p>
      <div className="mt-4 card p-4 text-sm">
        <p className="font-semibold">Sitemap for Google Search Console</p>
        <p className="mt-1 text-muted">
          Submit <code className="rounded bg-surface px-1">{SITE_URL}/sitemap.xml</code>. It updates automatically when you add or change
          categories and products.
        </p>
      </div>
      <ActionForm action={saveSeoPagesAction} className="mt-6 space-y-4">
        {(Object.keys(SEO_PAGES) as SeoPageKey[]).map((key) => {
          const page = SEO_PAGES[key];
          return (
            <fieldset key={key} className="card space-y-3 p-5">
              <legend className="sr-only">{page.label}</legend>
              <h2 className="font-bold">
                {page.label} <span className="text-sm font-normal text-muted">{page.path}</span>
              </h2>
              <label className="block">
                <span className="label">Title (up to 70 characters)</span>
                <input name={`${key}.title`} className="input" maxLength={70} defaultValue={saved[key]?.title ?? ""} placeholder={page.title} />
              </label>
              <label className="block">
                <span className="label">Description (up to 170 characters)</span>
                <textarea
                  name={`${key}.description`}
                  rows={2}
                  className="input"
                  maxLength={170}
                  defaultValue={saved[key]?.description ?? ""}
                  placeholder={page.description}
                />
              </label>
            </fieldset>
          );
        })}
        <SubmitButton className="btn-primary">Save SEO settings</SubmitButton>
      </ActionForm>
    </>
  );
}
