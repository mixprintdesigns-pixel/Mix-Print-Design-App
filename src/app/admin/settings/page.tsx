import { saveSiteSettingsAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { readSiteSettings, type SiteSettings } from "@/lib/content/site-settings";

export const metadata = { title: "Contact & social" };

const FIELDS: { name: keyof SiteSettings; label: string; hint?: string; type?: string }[] = [
  { name: "tagline", label: "Home page tagline" },
  { name: "address", label: "Address" },
  { name: "phoneDisplay", label: "Phone (as shown)", hint: "e.g. +92 303 488 9255" },
  { name: "whatsappNumber", label: "WhatsApp number", hint: "International format without +, e.g. 923034889255" },
  { name: "email", label: "Email", type: "email" },
  { name: "facebookUrl", label: "Facebook link" },
  { name: "instagramUrl", label: "Instagram link", hint: "Leave empty to hide the icon" },
  { name: "tiktokUrl", label: "TikTok link", hint: "Leave empty to hide the icon" },
  { name: "youtubeUrl", label: "YouTube link", hint: "Leave empty to hide the icon" },
  { name: "mapEmbedUrl", label: "Google Map link", hint: "Google Maps embed link, starts with https://www.google.com/maps" },
];

export default async function AdminSettingsPage() {
  await requireStaff(["ADMIN"]);
  const settings = await readSiteSettings();
  return (
    <>
      <h1 className="text-2xl font-bold">Contact &amp; social</h1>
      <p className="mt-1 text-sm text-muted">Shown in the footer, on the Contact page, the home page and the WhatsApp buttons.</p>
      <ActionForm action={saveSiteSettingsAction} className="card mt-6 max-w-2xl space-y-4 p-5">
        {FIELDS.map((f) => (
          <label key={f.name} className="block">
            <span className="label">{f.label}</span>
            <input name={f.name} type={f.type ?? "text"} className="input" defaultValue={settings[f.name]} />
            {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
        <SubmitButton className="btn-primary">Save contact details</SubmitButton>
      </ActionForm>
    </>
  );
}
