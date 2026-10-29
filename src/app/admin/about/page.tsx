import Image from "next/image";
import Link from "next/link";
import { saveAboutAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { DEFAULT_ABOUT, getAboutContent } from "@/lib/content/about";

export const metadata = { title: "About page" };

export default async function AdminAboutPage() {
  await requireStaff(["ADMIN"]);
  const about = await getAboutContent();
  const isPlaceholder = about.ownerName === DEFAULT_ABOUT.ownerName;
  const rows = [...about.highlights, ...Array.from({ length: Math.max(0, 6 - about.highlights.length) }, () => ({ title: "", text: "" }))];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">About page</h1>
        <Link href="/about" target="_blank" className="text-sm font-semibold text-brand">
          View page ↗
        </Link>
      </div>
      {isPlaceholder && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          The About page is showing placeholder text. Replace the owner details and story below.
        </p>
      )}
      <ActionForm action={saveAboutAction} className="mt-6 space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Company</h2>
          <label className="block">
            <span className="label">Our story</span>
            <textarea name="story" rows={6} className="input" defaultValue={about.story} maxLength={4000} />
          </label>
          <label className="block">
            <span className="label">Our mission</span>
            <textarea name="mission" rows={2} className="input" defaultValue={about.mission} maxLength={1000} />
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Owner profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Owner name</span>
              <input name="ownerName" className="input" defaultValue={about.ownerName} />
            </label>
            <label className="block">
              <span className="label">Title</span>
              <input name="ownerTitle" className="input" defaultValue={about.ownerTitle} />
            </label>
          </div>
          <label className="block">
            <span className="label">Short bio</span>
            <textarea name="ownerBio" rows={3} className="input" defaultValue={about.ownerBio} maxLength={1500} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            {about.ownerPhotoUrl && (
              <span className="relative h-20 w-20 overflow-hidden rounded-full ring-1 ring-border">
                <Image src={about.ownerPhotoUrl} alt="" fill sizes="80px" className="object-cover" />
              </span>
            )}
            <label className="block">
              <span className="label">Owner photo (JPG, PNG or WebP, up to 4 MB)</span>
              <input type="file" name="ownerPhoto" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            </label>
            {about.ownerPhotoUrl && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removePhoto" /> Remove photo
              </label>
            )}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">Why choose us</h2>
          <p className="text-sm text-muted">Up to 6 highlights. Leave a row empty to remove it.</p>
          {rows.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <input name="highlightTitle" className="input" defaultValue={h.title} placeholder="Title" aria-label={`Highlight ${i + 1} title`} />
              <input name="highlightText" className="input" defaultValue={h.text} placeholder="Description" aria-label={`Highlight ${i + 1} text`} />
            </div>
          ))}
        </section>

        <SubmitButton className="btn-primary">Save About page</SubmitButton>
      </ActionForm>
    </>
  );
}
