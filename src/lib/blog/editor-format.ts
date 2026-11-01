// Converts between the stored article format (lib/blog/content.ts) and the visual editor's document
// (TipTap / ProseMirror JSON). Articles stay stored in the same format, so the public pages, SEO and
// existing articles are unaffected; the editor only changes how they are written.

import { parseBlocks, parseInline, type Inline } from "./content";

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};
type Mark = NonNullable<DocNode["marks"]>[number];

// ─── Stored format → editor ──────────────────────────────────────────────────

/** "_blank" / "_self" when the editor chose, null for the default (outside sites new tab, own pages same tab). */
const targetFor = (newTab: boolean | undefined) => (newTab === undefined ? null : newTab ? "_blank" : "_self");

function inlineToDoc(nodes: Inline[], marks: Mark[] = []): DocNode[] {
  return nodes.flatMap((n): DocNode[] => {
    switch (n.type) {
      case "text":
        return n.text ? [{ type: "text", text: n.text, ...(marks.length ? { marks } : {}) }] : [];
      case "code":
        return n.text
          ? [
              {
                type: "text",
                text: n.text,
                marks: [...marks, { type: "code" }],
              },
            ]
          : [];
      case "strong":
        return inlineToDoc(n.children, [...marks, { type: "bold" }]);
      case "em":
        return inlineToDoc(n.children, [...marks, { type: "italic" }]);
      case "link":
        return inlineToDoc(n.children, [
          ...marks,
          {
            type: "link",
            attrs: { href: n.href, target: targetFor(n.newTab) },
          },
        ]);
    }
  });
}

const paragraph = (text: string): DocNode => {
  const content = inlineToDoc(parseInline(text));
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

export function markdownToDoc(source: string): DocNode {
  const content = parseBlocks(source).map((b): DocNode => {
    switch (b.type) {
      case "heading":
        return {
          type: "heading",
          attrs: { level: b.level },
          content: inlineToDoc(parseInline(b.text)),
        };
      case "paragraph":
        return paragraph(b.text);
      case "list":
        return {
          type: b.ordered ? "orderedList" : "bulletList",
          content: b.items.map((item) => ({
            type: "listItem",
            content: [paragraph(item)],
          })),
        };
      case "quote":
        return { type: "blockquote", content: [paragraph(b.text)] };
      case "table":
        return {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: b.header.map((h) => ({
                type: "tableHeader",
                content: [paragraph(h)],
              })),
            },
            ...b.rows.map((row) => ({
              type: "tableRow",
              content: row.map((c) => ({
                type: "tableCell",
                content: [paragraph(c)],
              })),
            })),
          ],
        };
      case "image":
        return {
          type: "image",
          attrs: {
            src: b.src,
            alt: b.alt,
            width: b.width ?? null,
            height: b.height ?? null,
            caption: b.caption ?? null,
            href: b.href ?? null,
            target: b.href ? targetFor(b.newTab) : null,
          },
        };
      case "rule":
        return { type: "horizontalRule" };
    }
  });
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

// ─── Editor → stored format ──────────────────────────────────────────────────

/** Backslash-escapes characters that would otherwise be read as formatting. */
export function escapeText(text: string): string {
  return text.replace(/[\\`*_[\]|]/g, "\\$&");
}

/** A paragraph or list item must not start like another block (a heading, list, quote or rule). */
function guardLineStart(line: string): string {
  if (/^(#|>|[-+]\s|\d+[.)]\s|-{3,}|!\\?\[)/.test(line)) {
    return line
      .replace(/^(\d+)([.)])/, "$1\\$2")
      .replace(/^([#>+-])/, "\\$1")
      .replace(/^!/, "\\!");
  }
  return line;
}

const safeHref = (href: string) => href.trim().replace(/\s/g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
const isOwnPage = (href: string) => href.startsWith("/") || href.startsWith("#");

/** ' "new"' or ' "same"' when the editor's choice differs from the default for that kind of link. */
function tabFlag(href: string, target: unknown): string {
  if (target !== "_blank" && target !== "_self") return "";
  const newTab = target === "_blank";
  const byDefault = !isOwnPage(href) && /^https?:/i.test(href);
  return newTab === byDefault ? "" : newTab ? ' "new"' : ' "same"';
}

const markKey = (m: Mark) => (m.type === "link" ? `link:${m.attrs?.href}:${m.attrs?.target ?? ""}` : m.type);

/** Serialises inline content, merging runs that share a mark so "**a** **b**" never splits mid-word. */
function inlineToMarkdown(nodes: DocNode[], order: string[] = ["link", "bold", "italic", "code"]): string {
  const [first, ...rest] = order;
  if (!first) return nodes.map((n) => (n.type === "text" ? escapeText(n.text ?? "") : n.type === "hardBreak" ? " " : "")).join("");
  let out = "";
  let i = 0;
  while (i < nodes.length) {
    const mark = nodes[i].marks?.find((m) => m.type === first);
    if (!mark) {
      let j = i;
      while (j < nodes.length && !nodes[j].marks?.some((m) => m.type === first)) j++;
      out += inlineToMarkdown(nodes.slice(i, j), rest);
      i = j;
      continue;
    }
    let j = i;
    while (j < nodes.length && nodes[j].marks?.some((m) => m.type === first && markKey(m) === markKey(mark))) j++;
    const group = nodes.slice(i, j);
    if (first === "code") {
      out += "`" + group.map((n) => (n.text ?? "").replace(/`/g, "")).join("") + "`";
    } else {
      const inner = inlineToMarkdown(group, rest);
      // Spaces stay outside the markers ("** bold**" would not be read as bold).
      const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
      if (!body) out += inner;
      else if (first === "bold") out += `${lead}**${body}**${trail}`;
      else if (first === "italic") out += `${lead}_${body}_${trail}`;
      else {
        const href = safeHref(String(mark.attrs?.href ?? ""));
        out += href ? `${lead}[${body}](${href}${tabFlag(href, mark.attrs?.target)})${trail}` : inner;
      }
    }
    i = j;
  }
  return out;
}

const textOf = (node: DocNode): string =>
  inlineToMarkdown(node.content ?? [])
    .replace(/\s+/g, " ")
    .trim();

/** Paragraph text of a container (list item, quote, table cell); nested lists and paragraphs join with spaces. */
function containerText(node: DocNode): string {
  return (node.content ?? [])
    .map((child) => (child.type === "paragraph" || child.type === "heading" ? textOf(child) : ""))
    .filter(Boolean)
    .join(" ");
}

function listItems(list: DocNode): string[] {
  return (list.content ?? [])
    .flatMap((item) => [
      containerText(item),
      // A list inside a list item becomes items of the same list (the article format has one level).
      ...(item.content ?? []).filter((c) => c.type === "bulletList" || c.type === "orderedList").flatMap(listItems),
    ])
    .filter(Boolean);
}

const cellText = (cell: DocNode) => containerText(cell).replace(/\n/g, " ") || " ";

function imageLine(attrs: Record<string, unknown>): string {
  const src = String(attrs.src ?? "").trim();
  if (!src) return "";
  const alt = String(attrs.alt ?? "")
    .replace(/[[\]\n]/g, "")
    .trim();
  const size = attrs.width && attrs.height ? ` =${Math.round(Number(attrs.width))}x${Math.round(Number(attrs.height))}` : "";
  const caption = typeof attrs.caption === "string" ? ` "${attrs.caption.replace(/[\\"]/g, "\\$&").replace(/\n/g, " ")}"` : "";
  const image = `![${alt}](${safeHref(src)}${size}${caption})`;
  const href = typeof attrs.href === "string" && attrs.href.trim() ? safeHref(attrs.href) : "";
  return href ? `[${image}](${href}${tabFlag(href, attrs.target)})` : image;
}

export function docToMarkdown(doc: DocNode): string {
  const blocks = (doc.content ?? []).flatMap((node): string[] => {
    switch (node.type) {
      case "heading": {
        const text = textOf(node);
        return text ? [`${Number(node.attrs?.level) >= 3 ? "###" : "##"} ${text}`] : [];
      }
      case "paragraph": {
        const text = textOf(node);
        return text ? [guardLineStart(text)] : [];
      }
      case "bulletList":
      case "orderedList": {
        const items = listItems(node);
        return items.length ? [items.map((t, i) => (node.type === "orderedList" ? `${i + 1}. ${t}` : `- ${t}`)).join("\n")] : [];
      }
      case "blockquote": {
        const text = containerText(node);
        return text ? [`> ${text}`] : [];
      }
      case "table": {
        const rows = (node.content ?? []).map((row) => (row.content ?? []).map(cellText));
        if (!rows.length || !rows[0].length) return [];
        const width = Math.max(...rows.map((r) => r.length));
        const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, k) => cells[k] ?? " ").join(" | ")} |`;
        return [[line(rows[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n")];
      }
      case "image": {
        const line = imageLine(node.attrs ?? {});
        return line ? [line] : [];
      }
      case "horizontalRule":
        return ["---"];
      default:
        return [];
    }
  });
  return blocks.join("\n\n");
}

/** Plain text that looks like Markdown (e.g. copied from ChatGPT as text): headings, lists, bold, tables. */
export function looksLikeMarkdown(text: string): boolean {
  return /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|.*\|)/m.test(text) || /\*\*[^*\n]+\*\*/.test(text);
}
