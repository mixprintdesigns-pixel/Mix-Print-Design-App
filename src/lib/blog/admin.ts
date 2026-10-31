import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toSlug } from "@/lib/slug";
import { parseBlocks, parseFaqs, safeImageUrl } from "./content";
import { META_DESCRIPTION_MAX, SEO_TITLE_MAX } from "./seo";

// Blog manager: saving, listing and deleting articles, and blog categories.

export class BlogInputError extends Error {
  constructor(
    message: string,
    public field = "_form",
  ) {
    super(message);
  }
}

export const BLOG_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;
export const BLOG_STATUS_LABELS = { DRAFT: "Draft", PUBLISHED: "Published", SCHEDULED: "Scheduled" } as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** "2026-11-01T10:30" entered in Pakistan time → the exact moment (Pakistan is UTC+5 all year). */
export function karachiLocalToDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The moment shown back in a datetime-local input, in Pakistan time. */
export function dateToKarachiLocal(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export const blogPostSchema = z.object({
  title: z.string().trim().min(3, "Enter a title.").max(200),
  slug: z.string().trim().max(80).optional().default(""),
  excerpt: z.string().trim().max(300, "Keep the short excerpt under 300 characters.").optional().default(""),
  content: z.string().max(200_000).optional().default(""),
  categoryId: optionalText(50),
  tags: z.string().max(500).optional().default(""),
  authorName: z.string().trim().max(100).optional().transform((v) => v || "Mix Print Design"),
  coverUrl: optionalText(1000),
  coverAlt: optionalText(200),
  status: z.enum(BLOG_STATUSES),
  publishAt: z.string().trim().optional().default(""),
  seoTitle: z
    .string()
    .trim()
    .max(SEO_TITLE_MAX, `Keep the SEO title under ${SEO_TITLE_MAX} characters.`)
    .optional()
    .transform((v) => v || null),
  seoDescription: z
    .string()
    .trim()
    .max(META_DESCRIPTION_MAX, `Keep the meta description under ${META_DESCRIPTION_MAX} characters.`)
    .optional()
    .transform((v) => v || null),
  focusKeyword: optionalText(80),
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https:\/\/\S+$/.test(v), "The canonical URL must start with https://, or leave it empty."),
  ogImageUrl: optionalText(1000),
  faqs: z.array(z.object({ question: z.string().max(300), answer: z.string().max(2000) })).max(30).optional().default([]),
  productIds: z.array(z.string().min(1).max(50)).max(12).optional().default([]),
});
export type BlogPostInput = z.input<typeof blogPostSchema>;

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  let slug = base;
  for (let n = 2; await prisma.blogPost.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }); n++) {
    slug = `${base.slice(0, 75)}-${n}`;
  }
  return slug;
}

/** Creates or updates an article. Returns its id and slug. */
export async function saveBlogPost(raw: BlogPostInput, id?: string | null, now = new Date()) {
  const parsed = blogPostSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BlogInputError(issue?.message ?? "Please check the article.", String(issue?.path[0] ?? "_form"));
  }
  const input = parsed.data;
  const existing = id ? await prisma.blogPost.findUnique({ where: { id }, select: { id: true, publishedAt: true, status: true } }) : null;
  if (id && !existing) throw new BlogInputError("This article no longer exists.");

  const wantedSlug = toSlug(input.slug || input.title);
  if (!wantedSlug || !SLUG.test(wantedSlug)) throw new BlogInputError("Enter a URL slug using letters, numbers and dashes.", "slug");
  if (input.slug && toSlug(input.slug) !== input.slug) throw new BlogInputError(`Use only lowercase letters, numbers and dashes in the URL slug, e.g. "${wantedSlug}".`, "slug");
  const clash = await prisma.blogPost.findFirst({ where: { slug: wantedSlug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash && input.slug) throw new BlogInputError("Another article already uses this URL slug.", "slug");
  const slug = clash ? await uniqueSlug(wantedSlug, id ?? undefined) : wantedSlug;

  if (input.coverUrl && !safeImageUrl(input.coverUrl)) throw new BlogInputError("The cover image link is not valid.", "coverUrl");
  if (input.coverUrl && !input.coverAlt) throw new BlogInputError("Add alt text (a short description) for the cover image.", "coverAlt");
  if (input.ogImageUrl && !safeImageUrl(input.ogImageUrl)) throw new BlogInputError("The social share image link is not valid.", "ogImageUrl");
  const missingAlt = parseBlocks(input.content).find((b) => b.type === "image" && !b.alt.trim());
  if (missingAlt) throw new BlogInputError("Every image in the article needs alt text: write it between the brackets, ![like this](…).", "content");

  let publishAt: Date | null = null;
  if (input.status === "SCHEDULED") {
    publishAt = karachiLocalToDate(input.publishAt);
    if (!publishAt) throw new BlogInputError("Choose the date and time to publish (Pakistan time).", "publishAt");
  }
  if (input.categoryId && !(await prisma.blogCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    throw new BlogInputError("Choose a category from the list.", "categoryId");
  }

  const publishedAt =
    input.status === "PUBLISHED" ? (existing?.status === "PUBLISHED" && existing.publishedAt ? existing.publishedAt : now) : input.status === "SCHEDULED" ? publishAt : null;

  const data = {
    title: input.title,
    slug,
    excerpt: input.excerpt,
    content: input.content,
    categoryId: input.categoryId,
    tags: [...new Set(input.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 15),
    authorName: input.authorName,
    coverUrl: input.coverUrl,
    coverAlt: input.coverUrl ? input.coverAlt : null,
    status: input.status,
    publishAt,
    publishedAt,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    focusKeyword: input.focusKeyword,
    canonicalUrl: input.canonicalUrl,
    ogImageUrl: input.ogImageUrl,
    faqs: parseFaqs(input.faqs) as unknown as Prisma.InputJsonValue,
    productIds: [...new Set(input.productIds)],
  };
  const saved = id ? await prisma.blogPost.update({ where: { id }, data }) : await prisma.blogPost.create({ data });
  return { id: saved.id, slug: saved.slug };
}

export async function deleteBlogPost(id: string) {
  await prisma.blogPost.delete({ where: { id } });
}

export async function getAdminBlogPost(id: string) {
  return prisma.blogPost.findUnique({ where: { id } });
}

export async function listAdminBlogPosts({ q, status, categoryId }: { q?: string; status?: string; categoryId?: string }) {
  const search = q?.trim();
  return prisma.blogPost.findMany({
    where: {
      ...(BLOG_STATUSES.includes(status as (typeof BLOG_STATUSES)[number]) ? { status: status as (typeof BLOG_STATUSES)[number] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, publishAt: true, publishedAt: true, updatedAt: true, category: { select: { name: true } } },
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function listBlogCategoriesForAdmin() {
  return prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, sortOrder: true, _count: { select: { posts: true } } },
  });
}

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(80),
  slug: z.string().trim().max(80).optional().default(""),
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
});

export async function saveBlogCategory(raw: z.input<typeof categorySchema>, id?: string | null) {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) throw new BlogInputError(parsed.error.issues[0]?.message ?? "Please check the category.");
  const slug = toSlug(parsed.data.slug || parsed.data.name);
  if (!slug) throw new BlogInputError("Enter a category name.");
  const clash = await prisma.blogCategory.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new BlogInputError("Another blog category already uses this name or slug.");
  const data = { name: parsed.data.name, slug, description: parsed.data.description, sortOrder: parsed.data.sortOrder };
  return id ? prisma.blogCategory.update({ where: { id }, data }) : prisma.blogCategory.create({ data });
}

/** Deletes a blog category; its articles stay and simply have no category. */
export async function deleteBlogCategory(id: string) {
  await prisma.blogCategory.delete({ where: { id } });
}
