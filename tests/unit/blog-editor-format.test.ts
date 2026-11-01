import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, type Block, type Inline } from "@/lib/blog/content";
import { docToMarkdown, escapeText, looksLikeMarkdown, markdownToDoc, type DocNode } from "@/lib/blog/editor-format";

// The visual editor must never change an article's meaning: stored text → editor → stored text keeps
// every heading, paragraph, mark, link, list, table and image.

type Segment = { text: string; marks: string };

/** What each character looks like (bold, italic, code, link), regardless of how the marks are nested. */
function flatten(nodes: Inline[], marks: string[] = []): Segment[] {
  return nodes.flatMap((n): Segment[] => {
    if (n.type === "text" || n.type === "code") {
      const all = n.type === "code" ? [...marks, "code"] : marks;
      // Spaces look the same in bold or italic, so only links count for them.
      return [...n.text].map((ch) => ({ text: ch, marks: (/\s/.test(ch) ? all.filter((m) => m.startsWith("link")) : all).sort().join(",") }));
    }
    if (n.type === "link") return flatten(n.children, [...marks, `link:${n.href}:${n.newTab ?? ""}`]);
    return flatten(n.children, [...marks, n.type]);
  }).reduce<Segment[]>((acc, seg) => {
    const last = acc.at(-1);
    if (last && last.marks === seg.marks) last.text += seg.text;
    else acc.push({ ...seg });
    return acc;
  }, []);
}

/** An article's meaning: its blocks, with text compared by how it looks. */
function meaning(md: string) {
  const inline = (t: string) => flatten(parseInline(t));
  return parseBlocks(md).map((b: Block) => {
    switch (b.type) {
      case "heading":
        return { type: b.type, level: b.level, text: inline(b.text) };
      case "paragraph":
      case "quote":
        return { type: b.type, text: inline(b.text) };
      case "list":
        return { type: b.type, ordered: b.ordered, items: b.items.map(inline) };
      case "table":
        return { type: b.type, header: b.header.map(inline), rows: b.rows.map((r) => r.map(inline)) };
      default:
        return b;
    }
  });
}

const roundTrip = (md: string) => docToMarkdown(markdownToDoc(md));

const SAMPLE_DRAFT = `Choosing the right business card is the first step to a great first impression. This guide explains the main **business card printing** options we offer in Lahore.

## Paper and finish

Most customers choose between **matte** and **gloss**:

- **Matte**: soft, non-reflective and easy to write on.
- **Gloss**: bright colours and a shiny look.
- **Matte lamination**: extra protection and a premium feel.

## Sizes

| Size | Best for |
| --- | --- |
| 3.5 × 2 in | Standard cards that fit every wallet |
| 2.5 × 2.5 in | Modern square cards |

### Quantity and price

Bigger quantities cost less per card. See our [business cards](/products) for live prices.

> Tip: always check the proof carefully before approving it.

## Order your cards

Choose your options on the product page and press **Order now**, or chat with us on WhatsApp.`;

const SIGN_BOARD = `# 3D Sign Board in Lahore

A **3D sign board** makes your shop *stand out* day and night. Prices start from Rs 1,500 per sq ft.

## Types of 3D sign boards
1. Simple acrylic letters
2. Acrylic with **LED** backlight
3. Steel letters with *gold* finish

![3D acrylic sign board on a shop front](https://abc123.public.blob.vercel-storage.com/blog/3d-sign-x.webp =1600x1067)

### Why choose us?
* Free design
* Installation across Lahore — call [0303 4889255](tel:+923034889255)
* Visit our [3D sign boards](/products/sign-board-maker/3d-sign-board) page or https://example.com

---

Text with a literal * star, an under_score, a [bracket], a | pipe and a back\\slash.
1. starts like a list but is not one`;

describe("visual editor ↔ stored article format", () => {
  it.each([
    ["the sample draft", SAMPLE_DRAFT],
    ["a long article with lists, images, links and a rule", SIGN_BOARD],
    ["bold and italic together", "Mixed **bold _and italic_ text** and _italic **with bold**_ here."],
    ["links with formatting and tabs", 'See [**our cards**](/products "new"), [Google](https://google.com "same") and [x](https://a.com).'],
    ["images with captions and links", '![Alt one](/media/blog/a.webp =800x600 "A caption")\n\n[![Alt two](/media/blog/b.webp =1600x900 "")](/products/cards "new")\n\n[![Alt three](https://x.public.blob.vercel-storage.com/c.webp)](https://example.com)'],
    ["an empty article", ""],
  ])("keeps the meaning of %s", (_, md) => {
    const once = roundTrip(md);
    expect(meaning(once)).toEqual(meaning(md));
    expect(roundTrip(once)).toBe(once); // stable after the first save
  });

  it("writes clean text: escapes only what would be read as formatting", () => {
    expect(escapeText("3*4 = a_b [x] | y")).toBe("3\\*4 = a\\_b \\[x\\] \\| y");
    expect(roundTrip("# Title\n\nPlain words.")).toBe("## Title\n\nPlain words.");
    expect(roundTrip("Text with *italic*.")).toBe("Text with _italic_.");
  });

  it("serialises the editor's own document (as typed in the editor)", () => {
    const doc: DocNode = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold ", marks: [{ type: "bold" }] },
            { type: "text", text: "both", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: " and a " },
            { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "/contact", target: "_blank" } }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }] }] }] }] },
        { type: "image", attrs: { src: "/media/blog/x.webp", alt: "A [sign]", width: 1600, height: 900, caption: 'Say "hi"', href: "/products", target: null } },
        { type: "paragraph" },
      ],
    };
    expect(docToMarkdown(doc)).toBe(
      ['## Hello', '**Bold _both_** and a [link](/contact "new")', "- one\n- nested", '[![A sign](/media/blog/x.webp =1600x900 "Say \\"hi\\"")](/products)'].join("\n\n"),
    );
    const [, , , image] = parseBlocks(docToMarkdown(doc));
    expect(image).toEqual({ type: "image", src: "/media/blog/x.webp", alt: "A sign", width: 1600, height: 900, caption: 'Say "hi"', href: "/products" });
  });

  it("recognises Markdown pasted as plain text", () => {
    expect(looksLikeMarkdown("## Heading\n\nText")).toBe(true);
    expect(looksLikeMarkdown("Some **bold** words")).toBe(true);
    expect(looksLikeMarkdown("Just a sentence.")).toBe(false);
  });
});
