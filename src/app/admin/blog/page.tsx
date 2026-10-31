import Link from "next/link";
import { deleteBlogPostAction } from "@/app/admin/blog-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BlogTabs } from "@/components/admin/blog/blog-tabs";
import { Badge, EmptyState } from "@/components/admin/section-ui";
import { requireStaff } from "@/lib/auth/session";
import { BLOG_STATUS_LABELS, BLOG_STATUSES, listAdminBlogPosts, listBlogCategoriesForAdmin } from "@/lib/blog/admin";
import { formatKarachiDate } from "@/lib/admin-sections/shared";

export const metadata = { title: "Blog" };

const tone = { DRAFT: "grey", PUBLISHED: "green", SCHEDULED: "blue" } as const;

export default async function AdminBlogPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireStaff(["ADMIN"]);
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const filters = { q: str(sp.q).slice(0, 100), status: str(sp.status), categoryId: str(sp.category) };
  const [posts, categories] = await Promise.all([listAdminBlogPosts(filters), listBlogCategoriesForAdmin()]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Blog</h1>
        <Link href="/admin/blog/new" className="btn-primary">
          New article
        </Link>
      </div>
      <BlogTabs current="articles" />
      {sp.deleted && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400" role="status">
          Article deleted.
        </p>
      )}

      <form action="/admin/blog" className="card mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_10rem_12rem_auto] sm:items-end" role="search">
        <label className="block">
          <span className="label">Search</span>
          <input name="q" defaultValue={filters.q} className="input" placeholder="Title or URL" />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={filters.status} className="input">
            <option value="">All</option>
            {BLOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BLOG_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select name="category" defaultValue={filters.categoryId} className="input">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">Filter</button>
      </form>

      {posts.length === 0 ? (
        <EmptyState>No articles found.</EmptyState>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Article</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Updated</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-border align-top last:border-0" data-testid="admin-blog-row">
                  <td className="p-3">
                    <Link href={`/admin/blog/${p.id}`} className="font-semibold text-brand hover:underline">
                      {p.title}
                    </Link>
                    <span className="block font-mono text-xs text-muted">/blog/{p.slug}</span>
                  </td>
                  <td className="p-3">{p.category?.name ?? "—"}</td>
                  <td className="p-3">
                    <Badge tone={tone[p.status]}>{BLOG_STATUS_LABELS[p.status]}</Badge>
                    {p.status === "SCHEDULED" && p.publishAt && <span className="mt-1 block text-xs text-muted">{formatKarachiDate(p.publishAt, true)}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs">{formatKarachiDate(p.updatedAt, true)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/blog/${p.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                        Edit
                      </Link>
                      {p.status !== "DRAFT" && (
                        <Link href={`/blog/${p.slug}`} target="_blank" className="text-xs font-semibold text-brand">
                          View ↗
                        </Link>
                      )}
                      <ActionForm action={deleteBlogPostAction} confirm={`Delete “${p.title}” permanently? This cannot be undone.`}>
                        <input type="hidden" name="postId" value={p.id} />
                        <SubmitButton className="px-2 py-1 text-xs font-semibold text-red-700 hover:underline dark:text-red-400">Delete</SubmitButton>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
