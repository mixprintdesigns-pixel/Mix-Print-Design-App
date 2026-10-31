import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCategoryTree, startingUnitPrice } from "@/lib/catalog/queries";
import { findById, productUrl } from "@/lib/catalog/tree";

// Public blog data. Only Published articles, and Scheduled ones whose time has come, are ever returned.
// Cached under BLOG_TAG (refreshed when an article is saved) and for a few minutes, so scheduled articles appear on time.

export const BLOG_TAG = "blog";
export const BLOG_PAGE_SIZE = 9;

function visibleNow(now = new Date()): Prisma.BlogPostWhereInput {
  return {
    OR: [
      { status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
      { status: "SCHEDULED", publishAt: { lte: now } },
    ],
  };
}

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverUrl: true,
  coverAlt: true,
  authorName: true,
  publishedAt: true,
  publishAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.BlogPostSelect;

export type BlogCard = Prisma.BlogPostGetPayload<{ select: typeof cardSelect }>;

/** The date shown on an article: when it was published (or scheduled for). */
export function postDate(post: { publishedAt: Date | null; publishAt: Date | null; createdAt: Date }): Date {
  return post.publishedAt ?? post.publishAt ?? post.createdAt;
}

const newestFirst = (a: BlogCard, b: BlogCard) => postDate(b).getTime() - postDate(a).getTime();

export async function getBlogCategories() {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  const categories = await prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, _count: { select: { posts: { where: visibleNow() } } } },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, postCount: _count.posts }));
}

/** One page of articles, newest first, optionally in one category and matching a search. */
export async function listPublishedPosts({ category, q, page = 1 }: { category?: string; q?: string; page?: number }) {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  const search = q?.trim();
  const where: Prisma.BlogPostWhereInput = {
    AND: [
      visibleNow(),
      ...(category ? [{ category: { slug: category } }] : []),
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { excerpt: { contains: search, mode: "insensitive" as const } },
                { content: { contains: search, mode: "insensitive" as const } },
                { tags: { has: search.toLowerCase() } },
              ],
            },
          ]
        : []),
    ],
  };
  const all = (await prisma.blogPost.findMany({ where, select: cardSelect })).sort(newestFirst);
  const pages = Math.max(1, Math.ceil(all.length / BLOG_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  return { posts: all.slice((current - 1) * BLOG_PAGE_SIZE, current * BLOG_PAGE_SIZE), total: all.length, page: current, pages };
}

export async function getPublishedPost(slug: string) {
  "use cache";
  cacheTag(BLOG_TAG, `blog:${slug}`);
  cacheLife("minutes");
  return prisma.blogPost.findFirst({ where: { AND: [{ slug }, visibleNow()] }, include: { category: { select: { id: true, name: true, slug: true } } } });
}

export type PublishedPost = NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>;

/** 3 other articles: same category first, then the newest. */
export async function getRelatedPosts(postId: string, categoryId: string | null, limit = 3): Promise<BlogCard[]> {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  const others = (await prisma.blogPost.findMany({ where: { AND: [visibleNow(), { id: { not: postId } }] }, select: { ...cardSelect, categoryId: true } })).sort(newestFirst);
  const same = others.filter((p) => categoryId && p.categoryId === categoryId);
  return [...same, ...others.filter((p) => !same.includes(p))].slice(0, limit);
}

/** Products linked to an article (only published ones in visible categories), in the chosen order. */
export async function getLinkedProducts(productIds: string[]) {
  "use cache";
  cacheTag(BLOG_TAG, "catalog");
  cacheLife("minutes");
  if (productIds.length === 0) return [];
  const [tree, products] = await Promise.all([
    getCategoryTree(),
    prisma.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        categoryId: true,
        basePriceMinor: true,
        isAvailable: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
        priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
      },
    }),
  ]);
  return productIds.flatMap((id) => {
    const p = products.find((x) => x.id === id);
    const category = p ? findById(tree, p.categoryId) : null;
    if (!p || !category) return [];
    return [{ ...p, href: productUrl(category.path, p.slug), fromPriceMinor: startingUnitPrice(p) }];
  });
}

/** Every published article, for the sitemap and the RSS feed. */
export async function getPublishedPostsForFeeds() {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  return (await prisma.blogPost.findMany({ where: visibleNow(), select: cardSelect })).sort(newestFirst);
}
