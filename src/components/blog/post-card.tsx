import Image from "next/image";
import Link from "next/link";
import { readingMinutes } from "@/lib/blog/content";
import { postDate, type BlogCard } from "@/lib/blog/queries";
import { formatKarachiDate } from "@/lib/admin-sections/shared";

/** An article in the blog grid: cover, category, title, excerpt, date and reading time. */
export function PostCard({ post, headingLevel = 2 }: { post: BlogCard; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand" data-testid="blog-card">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[1200/630] overflow-hidden bg-surface" tabIndex={-1} aria-hidden>
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-gradient-to-br from-brand/20 to-accent/10 text-3xl font-bold text-brand/60">Blog</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {post.category && (
          <Link href={`/blog?category=${post.category.slug}`} className="text-xs font-bold uppercase tracking-widest text-brand hover:underline">
            {post.category.name}
          </Link>
        )}
        <Heading className="mt-2 text-lg font-bold leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:text-brand">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{post.excerpt}</p>}
        <p className="mt-auto pt-4 text-xs text-muted">
          <time dateTime={postDate(post).toISOString()}>{formatKarachiDate(postDate(post))}</time> · {readingMinutes(post.content)} min read
        </p>
      </div>
    </article>
  );
}
