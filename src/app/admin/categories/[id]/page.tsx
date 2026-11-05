import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryFullEditor } from "@/components/admin/category-full/editor";
import { getCategoryFullData } from "@/lib/admin/category-full";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Edit category" };

/** Every setting of one category on one page: basic info, images, rates & calculator, commission, features, SEO. */
export default async function AdminCategoryFullPage({ params }: PageProps<"/admin/categories/[id]">) {
  await requireStaff(["ADMIN"]);
  const data = await getCategoryFullData((await params).id);
  if (!data) notFound();
  const href = `/services/${data.path.join("/")}`;
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/categories" className="font-semibold text-brand">
          ← Categories &amp; Services
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">{data.editable.category.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {data.trail.join(" › ")} ·{" "}
        <Link href={href} target="_blank" className="font-semibold text-brand">
          View page ↗
        </Link>
      </p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Sections of this page">
        {[
          ["basic", "Basic info"],
          ["images", "Images"],
          ...(data.rateEnabled
            ? [
                ["rates", "Rates & Calculator"],
                ["commission", "Affiliate commission"],
                ["features", "Features ✓"],
              ]
            : []),
          ["seo", "SEO"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium hover:border-brand">
            {label}
          </a>
        ))}
      </nav>
      {!data.rateEnabled && (
        <p className="mt-3 text-sm text-muted">This service uses its normal per-unit prices and quantity selector (the sq ft calculator is only for Digital Printing and Sign Board Maker).</p>
      )}
      <div className="mt-6">
        <CategoryFullEditor data={data} />
      </div>
    </>
  );
}
