import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { PostCard } from "@/components/blog/post-card";
import { getBlogCategories, listPublishedPosts } from "@/lib/blog/queries";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...seoMetadata({
    title: "Printing Tips & Guides Blog | Mix Print Design",
    description: "Guides and tips on business cards, sign boards, flex, offset and customized printing in Lahore, from the Mix Print Design team.",
    path: "/blog",
  }),
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }]} />
      <div className="mt-3 max-w-3xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Printing tips &amp; guides</h1>
        <p className="mt-2 text-muted">
          Simple guides to business cards, sign boards, flex and offset printing and custom gifts, from our team in Lahore.
        </p>
      </div>
      <Suspense fallback={<BlogSkeleton />}>
        <BlogListing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BlogSkeleton() {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-80 animate-pulse" />
      ))}
    </div>
  );
}

async function BlogListing({ searchParams }: { searchParams: PageProps<"/blog">["searchParams"] }) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const category = str(params.category).slice(0, 80);
  const q = str(params.q).trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(str(params.page), 10) || 1);
  const [categories, result] = await Promise.all([getBlogCategories(), listPublishedPosts({ category: category || undefined, q: q || undefined, page })]);
  const current = categories.find((c) => c.slug === category);
  const hrefFor = (next: { category?: string; q?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (next.category) sp.set("category", next.category);
    if (next.q) sp.set("q", next.q);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const s = sp.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Blog categories">
          <Link
            href={hrefFor({ q })}
            aria-current={!category ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${!category ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={hrefFor({ category: c.slug, q })}
              aria-current={c.slug === category ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${c.slug === category ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
            >
              {c.name} <span className="opacity-70">({c.postCount})</span>
            </Link>
          ))}
        </nav>
        <form action="/blog" role="search" className="flex w-full gap-2 lg:w-80">
          {category && <input type="hidden" name="category" value={category} />}
          <input type="search" name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" className="input" maxLength={100} />
          <button className="btn-primary px-4">Search</button>
        </form>
      </div>

      {(q || current) && (
        <p className="mt-4 text-sm text-muted" role="status">
          {result.total} article{result.total === 1 ? "" : "s"}
          {current && <> in {current.name}</>}
          {q && <> matching &quot;{q}&quot;</>} ·{" "}
          <Link href="/blog" className="font-semibold text-brand">
            Clear
          </Link>
        </p>
      )}

      {result.posts.length === 0 ? (
        <p className="card mt-8 p-10 text-center text-muted">{q || current ? "No articles found. Try another search or category." : "Articles are coming soon."}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pages">
          {result.page > 1 && (
            <Link href={hrefFor({ category, q, page: result.page - 1 })} className="btn-secondary px-4 py-2 text-sm" rel="prev">
              ← Newer
            </Link>
          )}
          <span className="px-3 text-sm text-muted">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages && (
            <Link href={hrefFor({ category, q, page: result.page + 1 })} className="btn-secondary px-4 py-2 text-sm" rel="next">
              Older →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
