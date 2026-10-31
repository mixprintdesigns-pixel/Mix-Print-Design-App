import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleBody } from "@/components/blog/article-body";
import { PostCard } from "@/components/blog/post-card";
import { ShareButtons } from "@/components/blog/share-buttons";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { JsonLd } from "@/components/catalog/json-ld";
import { formatKarachiDate } from "@/lib/admin-sections/shared";
import { headingsOf, parseBlocks, parseFaqs, readingMinutes } from "@/lib/blog/content";
import { getLinkedProducts, getPublishedPost, getPublishedPostsForFeeds, getRelatedPosts, postDate, type PublishedPost } from "@/lib/blog/queries";
import { autoMetaDescription, autoSeoTitle, autoShareImage } from "@/lib/blog/seo";
import { getSiteSettings, whatsappUrl } from "@/lib/content/site-settings";
import { formatPKR } from "@/lib/money";
import { absoluteUrl, SITE_NAME, seoMetadata } from "@/lib/seo";

type Params = PageProps<"/blog/[slug]">["params"];

/** Published articles are generated ahead of time; new ones on their first visit. */
export async function generateStaticParams() {
  const posts = await getPublishedPostsForFeeds();
  // Cache Components needs at least one entry to validate the route; an unknown slug renders the 404 page.
  return posts.length > 0 ? posts.map((p) => ({ slug: p.slug })) : [{ slug: "blog-empty" }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return { title: "Article not found", robots: { index: false } };
  const title = autoSeoTitle(post);
  const description = autoMetaDescription(post);
  const image = autoShareImage(post);
  const base = seoMetadata({ title, description, path: `/blog/${post.slug}`, images: image ? [{ url: image, alt: post.coverAlt ?? post.title }] : undefined });
  return {
    ...base,
    alternates: { canonical: post.canonicalUrl || `/blog/${post.slug}` },
    authors: [{ name: post.authorName }],
    keywords: [post.focusKeyword, ...post.tags].filter((k): k is string => !!k),
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: postDate(post).toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName],
      section: post.category?.name,
      tags: post.tags,
    },
  };
}

export default function BlogArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Suspense fallback={<div className="card mx-auto h-[40rem] max-w-3xl animate-pulse" />}>
        <Article params={params} />
      </Suspense>
    </div>
  );
}

// The URL is read inside <Suspense> so the page shell is static (Cache Components). Unknown slugs show the 404 page.
async function Article({ params }: { params: Params }) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();
  const blocks = parseBlocks(post.content);
  const headings = headingsOf(blocks);
  const faqs = parseFaqs(post.faqs);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const [settings, products, related] = await Promise.all([getSiteSettings(), getLinkedProducts(post.productIds), getRelatedPosts(post.id, post.categoryId)]);
  const minutes = readingMinutes(post.content);
  const published = postDate(post);

  return (
    <>
      <ArticleJsonLd post={post} faqs={faqs} />
      <article className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { name: "Blog", href: "/blog" },
            ...(post.category ? [{ name: post.category.name, href: `/blog?category=${post.category.slug}` }] : []),
            { name: post.title, href: `/blog/${post.slug}` },
          ]}
        />
        <header className="mt-4">
          {post.category && (
            <Link href={`/blog?category=${post.category.slug}`} className="text-xs font-bold uppercase tracking-widest text-brand hover:underline">
              {post.category.name}
            </Link>
          )}
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          {post.excerpt && <p className="mt-3 text-lg text-muted">{post.excerpt}</p>}
          <p className="mt-4 text-sm text-muted">
            By <span className="font-medium text-foreground">{post.authorName}</span> ·{" "}
            <time dateTime={published.toISOString()}>{formatKarachiDate(published)}</time> · {minutes} min read
          </p>
          <div className="mt-4">
            <ShareButtons url={url} title={post.title} />
          </div>
        </header>

        {post.coverUrl && (
          <div className="relative mt-6 aspect-[1200/630] overflow-hidden rounded-2xl bg-surface">
            <Image src={post.coverUrl} alt={post.coverAlt ?? post.title} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
          </div>
        )}

        {headings.length >= 3 && (
          <nav className="card mt-8 p-5" aria-label="Table of contents" data-testid="toc">
            <p className="font-semibold">In this article</p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "pl-4" : ""}>
                  <a href={`#${h.id}`} className="text-muted hover:text-brand">
                    {h.text.replace(/[*_`]/g, "")}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-8">
          <ArticleBody blocks={blocks} />
        </div>

        {faqs.length > 0 && (
          <section className="mt-10" aria-labelledby="faq-heading" data-testid="blog-faq">
            <h2 id="faq-heading" className="text-2xl font-bold">
              Frequently asked questions
            </h2>
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {faqs.map((f) => (
                <details key={f.question} className="group p-4">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {f.question}
                      <span aria-hidden className="text-brand transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="card mt-10 bg-gradient-to-br from-brand/10 via-surface to-accent/10 p-6 sm:p-8" aria-label="Order" data-testid="blog-cta">
          <p className="text-2xl font-bold">Ready to print?</p>
          <p className="mt-1 text-muted">Get a quick price and order online, or chat with our team on WhatsApp.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={products[0]?.href ?? "/products"} className="btn-primary px-5 py-2.5">
              Order now
            </Link>
            <a
              href={whatsappUrl(settings, `Assalam o Alaikum! I read "${post.title}" on your website and would like to order.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-green-600 px-5 py-2.5 text-white hover:bg-green-700"
            >
              Chat on WhatsApp
            </a>
          </div>
        </section>

        <div className="mt-8 border-t border-border pt-6">
          <ShareButtons url={url} title={post.title} />
          {post.tags.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-2 text-xs">
              {post.tags.map((t) => (
                <Link key={t} href={`/blog?q=${encodeURIComponent(t)}`} className="rounded-full bg-surface px-2.5 py-1 text-muted hover:text-brand">
                  #{t}
                </Link>
              ))}
            </p>
          )}
        </div>
      </article>

      {products.length > 0 && (
        <section className="mx-auto mt-12 max-w-5xl" aria-labelledby="related-products">
          <h2 id="related-products" className="text-2xl font-bold">
            Products in this article
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="card flex flex-col overflow-hidden" data-testid="blog-product">
                <Link href={p.href} className="relative block aspect-[4/3] bg-surface">
                  {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt || p.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold">
                    <Link href={p.href} className="hover:text-brand">
                      {p.name}
                    </Link>
                  </h3>
                  {p.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p>}
                  <p className="mt-2 text-sm">{p.fromPriceMinor > 0 ? <>From <span className="font-bold">{formatPKR(p.fromPriceMinor)}</span> per piece</> : "Price on request"}</p>
                  <Link href={p.href} className="btn-primary mt-auto self-start px-4 py-2 text-sm">
                    Order now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mx-auto mt-12 max-w-5xl" aria-labelledby="related-articles">
          <h2 id="related-articles" className="text-2xl font-bold">
            Related articles
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <PostCard key={r.id} post={r} headingLevel={3} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ArticleJsonLd({ post, faqs }: { post: PublishedPost; faqs: { question: string; answer: string }[] }) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const image = autoShareImage(post);
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: autoMetaDescription(post),
    ...(image ? { image: [absoluteUrl(image)] } : {}),
    datePublished: postDate(post).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absoluteUrl("/brand/mix-print-design-icon.png") } },
    mainEntityOfPage: { "@type": "WebPage", "@id": post.canonicalUrl || url },
    ...(post.category ? { articleSection: post.category.name } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
  };
  const faq =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }
      : null;
  return <JsonLd data={faq ? [article, faq] : article} />;
}
