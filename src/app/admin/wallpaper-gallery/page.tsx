import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SmallImageInput } from "@/components/admin/wallpaper/image-input";
import { requireStaff } from "@/lib/auth/session";
import { listWallpaperAdmin, nextDesignCode } from "@/lib/wallpaper/admin";
import {
  addWallpaperDesignAction,
  addWallpaperExtraImageAction,
  deleteWallpaperDesignAction,
  removeWallpaperExtraImageAction,
  saveWallpaperCategoriesAction,
  saveWallpaperDesignAction,
} from "./actions";

export const metadata = { title: "3D Wallpaper Gallery" };

export default async function AdminWallpaperGalleryPage() {
  await requireStaff();
  const [{ categories, designs }, nextCode] = await Promise.all([listWallpaperAdmin(), nextDesignCode()]);

  return (
    <>
      <h1 className="text-2xl font-bold">3D Wallpaper Gallery</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Designs shown on the{" "}
        <Link href="/services/digital-printing/3d-wallpaper#gallery" target="_blank" className="font-semibold text-brand">
          3D Wallpaper page ↗
        </Link>
        . Upload only a small preview picture: it is turned into a WebP (at most 1500 px) with a light Mix Print watermark. Keep the big print PDF on Google
        Drive and paste its link here: the link is shown only in Admin, never to customers. Rates are set in Categories &amp; Services → 3D Wallpaper → All
        settings.
      </p>

      <section className="card mt-6 p-5" aria-labelledby="add-design-heading">
        <h2 id="add-design-heading" className="text-lg font-bold">
          Add a design
        </h2>
        <ActionForm action={addWallpaperDesignAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <SmallImageInput label="Preview image (JPG, PNG or WebP)" />
          <label className="block">
            <span className="label">Title</span>
            <input name="title" className="input" required maxLength={120} placeholder="e.g. Golden marble waves" />
          </label>
          <label className="block">
            <span className="label">Design code (empty = {nextCode})</span>
            <input name="code" className="input uppercase" maxLength={20} placeholder={nextCode} />
          </label>
          <label className="block">
            <span className="label">Category</span>
            <select name="categoryId" className="input" defaultValue="">
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Print file link (Google Drive or other, optional, Admin only)</span>
            <input name="driveUrl" className="input" inputMode="url" maxLength={1000} placeholder="https://drive.google.com/…" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary">Add design</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="mt-8" aria-labelledby="designs-heading">
        <h2 id="designs-heading" className="text-lg font-bold">
          Designs ({designs.length})
        </h2>
        {designs.length === 0 && <p className="card mt-3 p-6 text-center text-muted">No designs yet.</p>}
        <ul className="mt-3 grid gap-4 lg:grid-cols-2">
          {designs.map((d) => (
            <li key={d.id} className="card p-4" data-testid="admin-design">
              <div className="flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img src={d.imageUrl} alt="" className="h-24 w-32 shrink-0 rounded object-cover" />
                <div className="min-w-0 text-sm">
                  <p className="font-bold">
                    {d.code} · {d.title}
                  </p>
                  {d.driveUrl ? (
                    <a href={d.driveUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-brand">
                      Open print file ↗
                    </a>
                  ) : (
                    <p className="text-muted">No print file link</p>
                  )}
                  {!d.isVisible && <p className="text-amber-700">Hidden</p>}
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">Edit</summary>
                <ActionForm action={saveWallpaperDesignAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={d.id} />
                  <label className="block">
                    <span className="label">Code</span>
                    <input name="code" className="input uppercase" defaultValue={d.code} required maxLength={20} />
                  </label>
                  <label className="block">
                    <span className="label">Title</span>
                    <input name="title" className="input" defaultValue={d.title} required maxLength={120} />
                  </label>
                  <label className="block">
                    <span className="label">Category</span>
                    <select name="categoryId" className="input" defaultValue={d.categoryId ?? ""}>
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Order</span>
                    <input name="sortOrder" type="number" className="input" defaultValue={d.sortOrder} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="label">Print file link (Admin only)</span>
                    <input name="driveUrl" className="input" defaultValue={d.driveUrl ?? ""} maxLength={1000} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isVisible" defaultChecked={d.isVisible} /> Show on the website
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton className="btn-primary">Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-4">
                  <p className="label">Extra previews</p>
                  <div className="flex flex-wrap gap-2">
                    {d.extraImages.map((x) => (
                      <ActionForm key={x.key} action={removeWallpaperExtraImageAction} className="relative">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="key" value={x.key} />
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                        <img src={x.url} alt="" className="h-16 w-20 rounded object-cover" />
                        <SubmitButton className="absolute right-0 top-0 rounded bg-black/60 px-1 text-xs text-white">×</SubmitButton>
                      </ActionForm>
                    ))}
                  </div>
                  <ActionForm action={addWallpaperExtraImageAction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <SmallImageInput label="Add an extra preview" />
                    <SubmitButton>Upload</SubmitButton>
                  </ActionForm>
                </div>
                <ActionForm action={deleteWallpaperDesignAction} confirm={`Delete ${d.code} and its previews? The file on Google Drive is not touched.`} className="mt-4">
                  <input type="hidden" name="id" value={d.id} />
                  <SubmitButton className="btn border border-red-300 px-3 py-1.5 text-xs text-red-700">Delete design</SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-8 p-5" aria-labelledby="wp-cats-heading">
        <h2 id="wp-cats-heading" className="text-lg font-bold">
          Gallery categories
        </h2>
        <p className="mt-1 text-sm text-muted">Each category has its own page, e.g. /services/digital-printing/3d-wallpaper/living-room, with its own SEO title and description.</p>
        <ActionForm action={saveWallpaperCategoriesAction} className="mt-4 space-y-3" confirm={undefined}>
          <input type="hidden" name="c_count" value={categories.length} />
          {categories.map((c, i) => (
            <div key={c.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1.2fr_5rem_auto_auto]" data-testid="wp-category">
              <input type="hidden" name={`c_id_${i}`} value={c.id} />
              <input name={`c_name_${i}`} className="input" defaultValue={c.name} aria-label={`Category ${i + 1} name`} />
              <input name={`c_slug_${i}`} className="input" defaultValue={c.slug} aria-label={`Category ${i + 1} address`} />
              <input name={`c_order_${i}`} type="number" className="input" defaultValue={c.sortOrder} aria-label={`Category ${i + 1} order`} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name={`c_on_${i}`} defaultChecked={c.isVisible} /> Show
              </label>
              <label className="flex items-center gap-1 text-sm text-red-700">
                <input type="checkbox" name={`c_del_${i}`} /> Delete ({c._count.designs} designs stay)
              </label>
              <input name={`c_desc_${i}`} className="input sm:col-span-5" defaultValue={c.description ?? ""} placeholder="Short description (shown on its page)" aria-label={`Category ${i + 1} description`} />
              <input name={`c_seot_${i}`} className="input sm:col-span-2" defaultValue={c.seoTitle ?? ""} maxLength={70} placeholder="SEO title (optional)" aria-label={`Category ${i + 1} SEO title`} />
              <input name={`c_seod_${i}`} className="input sm:col-span-3" defaultValue={c.seoDescription ?? ""} maxLength={170} placeholder="SEO description (optional)" aria-label={`Category ${i + 1} SEO description`} />
            </div>
          ))}
          <label className="block max-w-sm">
            <span className="label">Add a category</span>
            <input name="new_name" className="input" maxLength={80} placeholder="e.g. Hotel Lobby" />
          </label>
          <SubmitButton className="btn-primary">Save categories</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
