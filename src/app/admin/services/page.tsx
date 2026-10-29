import Image from "next/image";
import {
  linkServiceProductAction,
  saveServiceLevelAction,
  serviceLevelCommandAction,
  unlinkServiceProductAction,
  uploadServiceImageAction,
} from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { getServiceTreeForAdmin, listLinkableProducts, type ServiceLevel } from "@/lib/services/admin";

export const metadata = { title: "Services" };

type Tree = Awaited<ReturnType<typeof getServiceTreeForAdmin>>;
type Item = { id: string; slug: string; title: string; shortDescription: string; imageUrl: string | null; isVisible: boolean };
type Products = Awaited<ReturnType<typeof listLinkableProducts>>;

const LEVEL_NAME: Record<ServiceLevel, string> = { category: "service category", subtype: "sub-type", quality: "quality" };

function LevelFields({ item, level, parentId }: { item?: Item; level: ServiceLevel; parentId?: string }) {
  return (
    <>
      <input type="hidden" name="level" value={level} />
      {item && <input type="hidden" name="id" value={item.id} />}
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <div className="grid w-full gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="label">Title</span>
          <input name="title" className="input py-2" defaultValue={item?.title} required />
        </label>
        <label className="block">
          <span className="label">Slug (optional)</span>
          <input name="slug" className="input py-2" defaultValue={item?.slug} placeholder="made from the title" />
        </label>
      </div>
      <label className="block w-full">
        <span className="label">Short description</span>
        <input name="shortDescription" className="input py-2" defaultValue={item?.shortDescription} required maxLength={300} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isVisible" defaultChecked={item?.isVisible ?? true} /> Visible on the website
      </label>
    </>
  );
}

function LevelTools({ item, level, products, linked }: { item: Item; level: ServiceLevel; products: Products; linked?: { id: string; name: string; status: string }[] }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-background ring-1 ring-border">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-xs text-muted">No image</span>
          )}
        </div>
        <ActionForm action={uploadServiceImageAction}>
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="id" value={item.id} />
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="max-w-56 text-xs" aria-label={`Image for ${item.title}`} />
          <SubmitButton>Upload image</SubmitButton>
        </ActionForm>
        <ActionForm action={serviceLevelCommandAction} className="flex flex-wrap gap-1">
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton name="command" value="up" className="btn-secondary px-2 py-1 text-xs">
            ↑ Up
          </SubmitButton>
          <SubmitButton name="command" value="down" className="btn-secondary px-2 py-1 text-xs">
            ↓ Down
          </SubmitButton>
          {item.imageUrl && (
            <SubmitButton name="command" value="remove-image" className="btn-secondary px-2 py-1 text-xs">
              Remove image
            </SubmitButton>
          )}
          <SubmitButton name="command" value="delete" className="btn-secondary px-2 py-1 text-xs text-red-600">
            Delete
          </SubmitButton>
        </ActionForm>
      </div>

      <details>
        <summary className="cursor-pointer font-semibold text-brand">Edit {LEVEL_NAME[level]}</summary>
        <ActionForm action={saveServiceLevelAction} className="mt-2 space-y-2">
          <LevelFields item={item} level={level} />
          <SubmitButton className="btn-secondary">Save</SubmitButton>
        </ActionForm>
      </details>

      <div>
        <p className="font-medium">Products shown here</p>
        {linked && linked.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {linked.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2" data-testid="linked-product">
                <span>
                  {p.name}
                  {p.status !== "PUBLISHED" && <span className="ml-1 text-xs text-muted">({p.status.toLowerCase()}, not shown)</span>}
                </span>
                <ActionForm action={unlinkServiceProductAction}>
                  <input type="hidden" name="productId" value={p.id} />
                  <SubmitButton className="text-xs text-red-600 underline">Unlink</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">None yet.</p>
        )}
        <ActionForm action={linkServiceProductAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="id" value={item.id} />
          <select name="productId" className="input max-w-64 py-1.5 text-xs" aria-label={`Link a product to ${item.title}`} defaultValue="">
            <option value="">Link a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.serviceCategoryId ? " (moves it here)" : ""}
              </option>
            ))}
          </select>
          <SubmitButton>Link</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

function Visibility({ visible }: { visible: boolean }) {
  return visible ? null : <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-normal dark:bg-stone-800">hidden</span>;
}

export default async function AdminServicesPage() {
  await requireStaff(["ADMIN"]);
  const [tree, products] = await Promise.all([getServiceTreeForAdmin(), listLinkableProducts()]);
  const linkedTo = (category: Tree[number], subtypeId: string | null, qualityId: string | null) =>
    category.products.filter((p) => p.serviceSubtypeId === subtypeId && p.serviceQualityId === qualityId);

  return (
    <>
      <h1 className="text-2xl font-bold">Services</h1>
      <p className="mt-1 text-sm text-muted">
        Service category → sub-type → quality. Products linked at any level appear automatically on the Services page and home page.
      </p>

      <ActionForm action={saveServiceLevelAction} className="card mt-6 space-y-3 p-5">
        <h2 className="w-full font-bold">Add a service category</h2>
        <LevelFields level="category" />
        <SubmitButton className="btn-primary">Add service category</SubmitButton>
      </ActionForm>

      <ul className="mt-6 space-y-6">
        {tree.map((category) => (
          <li key={category.id} className="card p-5" data-testid="admin-service">
            <h2 className="text-xl font-bold">
              {category.title}
              <Visibility visible={category.isVisible} />
            </h2>
            <p className="text-sm text-muted">/services/{category.slug} · {category.shortDescription}</p>
            <LevelTools item={category} level="category" products={products} linked={linkedTo(category, null, null)} />

            <ul className="mt-5 space-y-4 border-l-2 border-accent/30 pl-4">
              {category.subtypes.map((subtype) => (
                <li key={subtype.id} className="rounded-lg border border-border p-4" data-testid="admin-subtype">
                  <h3 className="font-bold">
                    {subtype.title}
                    <Visibility visible={subtype.isVisible} />
                  </h3>
                  <p className="text-sm text-muted">{subtype.shortDescription}</p>
                  <LevelTools item={subtype} level="subtype" products={products} linked={linkedTo(category, subtype.id, null)} />

                  <ul className="mt-4 space-y-3 border-l-2 border-brand/20 pl-4">
                    {subtype.qualities.map((quality) => (
                      <li key={quality.id} className="rounded-lg bg-background p-3" data-testid="admin-quality">
                        <h4 className="font-semibold">
                          {quality.title}
                          <Visibility visible={quality.isVisible} />
                        </h4>
                        <p className="text-sm text-muted">{quality.shortDescription}</p>
                        <LevelTools item={quality} level="quality" products={products} linked={linkedTo(category, subtype.id, quality.id)} />
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">+ Add quality to {subtype.title}</summary>
                    <ActionForm action={saveServiceLevelAction} className="mt-2 space-y-2">
                      <LevelFields level="quality" parentId={subtype.id} />
                      <SubmitButton className="btn-secondary">Add quality</SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand">+ Add sub-type to {category.title}</summary>
              <ActionForm action={saveServiceLevelAction} className="mt-2 space-y-2">
                <LevelFields level="subtype" parentId={category.id} />
                <SubmitButton className="btn-secondary">Add sub-type</SubmitButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
