import { describe, expect, it } from "vitest";
import { headingsOf, parseBlocks, parseFaqs, parseInline, readingMinutes, safeLinkUrl, wordCount } from "@/lib/blog/content";
import { autoMetaDescription, autoSeoTitle, autoShareImage, clip, seoChecklist } from "@/lib/blog/seo";

const ARTICLE = `Business card printing in Lahore made simple.

# Paper
## Paper
Some **bold** and *italic* text with a [link](/products) and [bad](javascript:alert(1)).

- one
- two

1. first
2. second

> A quote
> continues

| Size | Use |
| --- | --- |
| 3.5 × 2 | Standard |

![Matte cards on a desk](https://abc.public.blob.vercel-storage.com/blog/x.webp =1600x900)

![](https://example.com/no-alt.png)

### Sub heading`;

describe("blog article format", () => {
  it("parses headings (one H1 only: # becomes H2), lists, quotes, tables and images", () => {
    const blocks = parseBlocks(ARTICLE);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading", "heading", "paragraph", "list", "list", "quote", "table", "image", "image", "heading"]);
    const headings = headingsOf(blocks);
    expect(headings.map((h) => [h.level, h.id])).toEqual([
      [2, "paper"],
      [2, "paper-2"],
      [3, "sub-heading"],
    ]);
    expect(blocks[4]).toEqual({ type: "list", ordered: false, items: ["one", "two"] });
    expect(blocks[5]).toMatchObject({ ordered: true, items: ["first", "second"] });
    expect(blocks[6]).toEqual({ type: "quote", text: "A quote continues" });
    expect(blocks[7]).toEqual({ type: "table", header: ["Size", "Use"], rows: [["3.5 × 2", "Standard"]] });
    expect(blocks[8]).toEqual({ type: "image", src: "https://abc.public.blob.vercel-storage.com/blog/x.webp", alt: "Matte cards on a desk", width: 1600, height: 900 });
  });

  it("keeps links safe: no javascript: links", () => {
    const nodes = parseInline("a [link](/products) and [bad](javascript:alert(1)) **b**");
    expect(nodes.filter((n) => n.type === "link")).toEqual([{ type: "link", href: "/products", children: [{ type: "text", text: "link" }] }]);
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(parseBlocks("![x](javascript:alert(1))")).toEqual([]);
  });

  it("counts words and reading time, and cleans FAQs", () => {
    expect(wordCount("## Hello world\n\nOne **two** three.")).toBe(5);
    expect(readingMinutes("word ".repeat(1000))).toBe(5);
    expect(readingMinutes("short")).toBe(1);
    expect(parseFaqs([{ question: " Q? ", answer: " A " }, { question: "", answer: "x" }, "junk"])).toEqual([{ question: "Q?", answer: "A" }]);
  });
});

describe("blog SEO", () => {
  it("fills in the SEO title, description and share image when left empty", () => {
    expect(autoSeoTitle({ title: "Matte Cards" })).toBe("Matte Cards | Mix Print Design");
    expect(autoSeoTitle({ title: "Matte Cards", seoTitle: "Custom" })).toBe("Custom");
    expect(autoSeoTitle({ title: "x".repeat(65) }).length).toBeLessThanOrEqual(70);
    expect(autoMetaDescription({ excerpt: "Short excerpt.", content: "" })).toBe("Short excerpt.");
    expect(autoMetaDescription({ content: "word ".repeat(100) }).length).toBeLessThanOrEqual(160);
    expect(autoShareImage({ coverUrl: "/c.webp" })).toBe("/c.webp");
    expect(autoShareImage({ coverUrl: "/c.webp", ogImageUrl: "/o.webp" })).toBe("/o.webp");
    expect(clip("one two three four", 10)).toBe("one two…");
  });

  it("checks keyword placement, alt texts, length and internal links", () => {
    const base = { title: "Business Card Printing Guide", slug: "business-card-printing-guide", focusKeyword: "business card printing", coverUrl: "/c.webp", coverAlt: "Cards" };
    const good = seoChecklist({ ...base, content: `Business card printing tips. See [products](/products).\n\n${"word ".repeat(800)}` });
    expect(good.every((c) => c.ok)).toBe(true);
    const bad = seoChecklist({ ...base, coverAlt: "", content: "Nothing here.\n\n![](/x.webp)" });
    expect(bad.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      "Keyword in the first paragraph",
      "Every image has alt text",
      "At least 800 words (now 2)",
      "Links to other pages on the site",
    ]);
  });
});
