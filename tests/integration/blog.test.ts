import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { deleteBlogCategory, deleteBlogPost, karachiLocalToDate, saveBlogCategory, saveBlogPost, type BlogPostInput } from "@/lib/blog/admin";
import { createTestProduct, resetDatabase } from "../support/db";

// Cache helpers only work inside Next.js; here the queries run directly.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
const { getLinkedProducts, getPublishedPost, getPublishedPostsForFeeds, getRelatedPosts, listPublishedPosts } = await import("@/lib/blog/queries");

beforeEach(resetDatabase);

const article = (overrides: Partial<BlogPostInput> = {}): BlogPostInput => ({
  title: "Matte Business Cards Guide",
  content: "Intro about matte business cards.\n\n## Paper\n\nText.",
  status: "PUBLISHED",
  ...overrides,
});

describe("saving articles", () => {
  it("makes the slug from the title, keeps slugs unique, and tidies tags", async () => {
    const a = await saveBlogPost(article({ tags: "Cards, lahore , cards" }));
    expect(a.slug).toBe("matte-business-cards-guide");
    const b = await saveBlogPost(article());
    expect(b.slug).toBe("matte-business-cards-guide-2");
    expect((await prisma.blogPost.findUniqueOrThrow({ where: { id: a.id } })).tags).toEqual(["cards", "lahore"]);
    await expect(saveBlogPost(article({ slug: "matte-business-cards-guide" }))).rejects.toThrow(/already uses this URL slug/);
    await expect(saveBlogPost(article({ slug: "Bad Slug!" }))).rejects.toThrow(/lowercase letters/);
  });

  it("requires alt text for the cover and every image, and a time for scheduled articles", async () => {
    await expect(saveBlogPost(article({ coverUrl: "/media/blog/c.webp" }))).rejects.toThrow(/alt text/);
    await expect(saveBlogPost(article({ content: "![](/media/blog/x.webp)" }))).rejects.toThrow(/alt text/);
    await expect(saveBlogPost(article({ status: "SCHEDULED" }))).rejects.toThrow(/date and time/);
    await expect(saveBlogPost(article({ seoTitle: "x".repeat(71) }))).rejects.toThrow(/SEO title/);
    await expect(saveBlogPost(article({ canonicalUrl: "http://insecure.example" }))).rejects.toThrow(/https/);
  });

  it("reads Pakistan time for scheduling", () => {
    expect(karachiLocalToDate("2026-11-01T10:30")!.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(karachiLocalToDate("tomorrow")).toBeNull();
  });
});

describe("what the public sees", () => {
  it("shows only Published articles and Scheduled ones whose time has come, newest first", async () => {
    await saveBlogPost(article({ title: "Draft one", status: "DRAFT" }));
    const live = await saveBlogPost(article({ title: "Live one" }));
    await saveBlogPost(article({ title: "Future one", status: "SCHEDULED", publishAt: "2099-01-01T09:00" }));
    const due = await saveBlogPost(article({ title: "Due one", status: "SCHEDULED", publishAt: "2020-01-01T09:00" }));

    const { posts, total } = await listPublishedPosts({});
    expect(total).toBe(2);
    expect(posts.map((p) => p.title)).toEqual(["Live one", "Due one"]);
    expect(await getPublishedPost("draft-one")).toBeNull();
    expect(await getPublishedPost("future-one")).toBeNull();
    expect((await getPublishedPost(live.slug))?.title).toBe("Live one");
    expect((await getPublishedPost(due.slug))?.title).toBe("Due one");
    expect((await getPublishedPostsForFeeds()).map((p) => p.slug)).toEqual([live.slug, due.slug]);
  });

  it("filters by category and search, and pages", async () => {
    const cat = await saveBlogCategory({ name: "Sign Boards" });
    await saveBlogPost(article({ title: "3D sign boards explained", categoryId: cat.id }));
    for (let i = 0; i < 10; i++) await saveBlogPost(article({ title: `Card tip ${i}` }));
    expect((await listPublishedPosts({ category: "sign-boards" })).posts.map((p) => p.title)).toEqual(["3D sign boards explained"]);
    expect((await listPublishedPosts({ q: "3D SIGN" })).total).toBe(1);
    const page1 = await listPublishedPosts({});
    expect(page1).toMatchObject({ total: 11, pages: 2, page: 1 });
    expect(page1.posts).toHaveLength(9);
    expect((await listPublishedPosts({ page: 2 })).posts).toHaveLength(2);
  });

  it("links products and finds related articles (same category first)", async () => {
    const product = await createTestProduct();
    const cat = await saveBlogCategory({ name: "Business Cards" });
    const main = await saveBlogPost(article({ title: "Main", categoryId: cat.id, productIds: [product.id, "missing"] }));
    await saveBlogPost(article({ title: "Other" }));
    await saveBlogPost(article({ title: "Same category", categoryId: cat.id }));
    const post = (await getPublishedPost(main.slug))!;
    const linked = await getLinkedProducts(post.productIds);
    expect(linked.map((p) => p.id)).toEqual([product.id]);
    expect(linked[0].href).toMatch(new RegExp(`/products/.+/${product.slug}$`));
    expect((await getRelatedPosts(post.id, post.categoryId)).map((p) => p.title)).toEqual(["Same category", "Other"]);
  });

  it("deleting a category keeps its articles; articles can be deleted", async () => {
    const cat = await saveBlogCategory({ name: "Tips" });
    const a = await saveBlogPost(article({ categoryId: cat.id }));
    await deleteBlogCategory(cat.id);
    expect((await prisma.blogPost.findUniqueOrThrow({ where: { id: a.id } })).categoryId).toBeNull();
    await deleteBlogPost(a.id);
    expect(await prisma.blogPost.count()).toBe(0);
  });
});
