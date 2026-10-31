import "server-only";
import { prisma } from "@/lib/db";
import { directUploadAvailable } from "@/lib/storage/blob-direct";
import { SITE_URL } from "@/lib/seo";
import type { BlogEditorValues } from "@/components/admin/blog/blog-editor";
import { dateToKarachiLocal, getAdminBlogPost } from "./admin";
import { parseFaqs } from "./content";

// Everything the admin article editor needs.

export async function blogEditorData(postId: string | null) {
  const [post, categories, products] = await Promise.all([
    postId ? getAdminBlogPost(postId) : null,
    prisma.blogCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: { select: { name: true } } } }),
  ]);
  if (postId && !post) return null;

  const initial: BlogEditorValues = {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    categoryId: post?.categoryId ?? "",
    tags: post?.tags.join(", ") ?? "",
    authorName: post?.authorName ?? "Mix Print Design",
    coverUrl: post?.coverUrl ?? "",
    coverAlt: post?.coverAlt ?? "",
    status: post?.status ?? "DRAFT",
    publishAt: dateToKarachiLocal(post?.publishAt ?? null),
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    focusKeyword: post?.focusKeyword ?? "",
    canonicalUrl: post?.canonicalUrl ?? "",
    ogImageUrl: post?.ogImageUrl ?? "",
    faqs: parseFaqs(post?.faqs),
    productIds: post?.productIds ?? [],
  };
  const live = post && (post.status === "PUBLISHED" || (post.status === "SCHEDULED" && post.publishAt && post.publishAt <= new Date()));
  return {
    post,
    initial,
    categories,
    products: products.map((p) => ({ id: p.id, name: p.name, category: p.category.name })),
    directUpload: directUploadAvailable(),
    siteUrl: SITE_URL,
    publicUrl: live ? `/blog/${post.slug}` : null,
  };
}
