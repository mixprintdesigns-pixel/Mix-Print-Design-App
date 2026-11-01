// Blog article format: a small, safe Markdown subset written by the admin editor's toolbar.
// Parsed into blocks here (no HTML is ever passed through), and rendered as React elements by
// components/blog/article-body.tsx. Shared by the server pages and the editor's live preview.
//
//   ## Heading / ### Sub-heading      paragraphs (blank line between)
//   - item / 1. item                   > quote
//   | a | b |  (header, --- row, rows) ![alt text](url =1600x900 "optional caption")  (image on its own line)
//   [![alt](url =1600x900)](/products/… "new")  clickable image ("new" / "same": open in a new tab or not)
//   **bold**  *italic*  `code`  [link text](/products or https://… "new")   \* \| \# … a literal character
//
// The admin's visual editor (components/admin/blog/article-editor.tsx) reads and writes this format,
// see lib/blog/editor-format.ts.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[]; newTab?: boolean };

export type Block =
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "image"; src: string; alt: string; width?: number; height?: number; caption?: string; href?: string; newTab?: boolean }
  | { type: "rule" };

export function slugifyHeading(text: string): string {
  return (
    stripInline(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "section"
  );
}

/** Images may come from our own storage (/media/…) or https; links also allow #, mailto: and tel:. */
export function safeImageUrl(url: string): string | null {
  const u = url.trim();
  return /^https:\/\/[^\s]+$/i.test(u) || /^\/[^\s/][^\s]*$/.test(u) ? u : null;
}

export function safeLinkUrl(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|\/|#|mailto:|tel:)[^\s]*$/i.test(u) ? u : null;
}

// An image: ![alt](src =WxH "caption"), the size and caption being optional.
const IMAGE = String.raw`!\[([^\]]*)\]\(\s*(\S+?)(?:\s+=(\d{1,5})x(\d{1,5}))?(?:\s+"((?:[^"\\]|\\.)*)")?\s*\)`;
// On its own line, either plain or inside a link: [IMAGE](href "new"|"same").
const IMAGE_LINE = new RegExp(String.raw`^(?:${IMAGE}|\[${IMAGE}\]\(\s*(\S+?)(?:\s+"(new|same)")?\s*\))$`);
const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

/** Characters the editor escapes with a backslash so text is never read as formatting. */
const ESCAPABLE = String.raw`[\\` + "`" + String.raw`*_\[\]()|#>!+\-.~"]`;
const ESCAPE = new RegExp(String.raw`\\(` + ESCAPABLE + ")", "g");

/** "\*" → "*". */
export function unescapeMarkdown(text: string): string {
  return text.replace(ESCAPE, "$1");
}

/** Table cells: split on "|", but not on an escaped "\|". */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const usedIds = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugifyHeading(text);
    const n = usedIds.get(base) ?? 0;
    usedIds.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      // The page title is the only H1, so "#" becomes H2 and anything deeper than ### becomes H3.
      const level = heading[1].length <= 2 ? 2 : 3;
      const text = heading[2].replace(/\s+#+$/, "").trim();
      blocks.push({ type: "heading", level, text, id: uniqueId(text) });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      // Groups 1–5: a plain image (alt, src, width, height, caption); 6–10: the same inside a link,
      // then 11 = the link and 12 = "new" / "same" tab.
      const linked = image[7] !== undefined;
      const [alt, url, w, h, caption] = linked ? image.slice(6, 11) : image.slice(1, 6);
      const src = safeImageUrl(url);
      const href = linked ? safeLinkUrl(image[11]) : null;
      if (src) {
        blocks.push({
          type: "image",
          src,
          alt: alt.trim(),
          ...(w && h ? { width: Number(w), height: Number(h) } : {}),
          ...(caption !== undefined ? { caption: unescapeMarkdown(caption) } : {}),
          ...(href ? { href, ...(image[12] ? { newTab: image[12] === "new" } : {}) } : {}),
        });
      }
      i++;
      continue;
    }

    if (line.startsWith("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1].trim())) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i]);
        rows.push(header.map((_, k) => cells[k] ?? ""));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (line.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: parts.join(" ").trim() });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/;
    const numbered = /^\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const pattern = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) {
        items.push(pattern.exec(lines[i].trim())![1]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: consecutive lines that do not start another block.
    const parts: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^#{1,6}\s/.test(l) || l.startsWith(">") || l.startsWith("|") || IMAGE_LINE.test(l) || /^[-*+]\s/.test(l) || /^\d+[.)]\s/.test(l) || /^(-{3,}|\*{3,})$/.test(l)) {
        break;
      }
      parts.push(l);
      i++;
    }
    blocks.push({ type: "paragraph", text: parts.join(" ") });
  }
  return blocks;
}

/** Inline formatting: **bold**, *italic*, `code`, [text](url). Anything else is plain text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  // 1: an escaped character; 2–3: **bold**; 4–5: `code`; 6–9: [text](href "new"|"same"); 10–11: *italic*; 12–13: _italic_
  const pattern = new RegExp(
    String.raw`(\\` +
      ESCAPABLE +
      String.raw`)|(\*\*((?:\\.|[^*\\])+?)\*\*)|(` +
      "`([^`]+)`" +
      String.raw`)|(\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)(?:\s+"(new|same)")?\))|(\*((?:\\.|[^*\s\\])(?:\\.|[^*\\])*?)\*)|(_((?:\\.|[^_\s\\])(?:\\.|[^_\\])*?)_)`,
  );
  const pushText = (t: string) => {
    const last = out.at(-1);
    if (last?.type === "text") last.text += t;
    else out.push({ type: "text", text: t });
  };
  while (rest) {
    const m = pattern.exec(rest);
    if (!m) {
      pushText(rest);
      break;
    }
    if (m.index > 0) pushText(rest.slice(0, m.index));
    if (m[1]) pushText(m[1].slice(1));
    else if (m[2]) out.push({ type: "strong", children: parseInline(m[3]) });
    else if (m[4]) out.push({ type: "code", text: m[5] });
    else if (m[6]) {
      const href = safeLinkUrl(m[8]);
      out.push(
        href
          ? { type: "link", href, children: parseInline(m[7]), ...(m[9] ? { newTab: m[9] === "new" } : {}) }
          : { type: "text", text: unescapeMarkdown(m[7]) },
      );
    } else if (m[10]) out.push({ type: "em", children: parseInline(m[11]) });
    else if (m[12]) out.push({ type: "em", children: parseInline(m[13]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const inlineText = (nodes: Inline[]): string =>
  nodes.map((n) => (n.type === "text" || n.type === "code" ? n.text : inlineText(n.children))).join("");

/** The text without formatting marks, e.g. for word counts and search. */
export function stripInline(text: string): string {
  return inlineText(parseInline(text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")));
}

export function plainText(source: string): string {
  return parseBlocks(source)
    .map((b) => {
      switch (b.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return stripInline(b.text);
        case "list":
          return b.items.map(stripInline).join(" ");
        case "table":
          return [...b.header, ...b.rows.flat()].map(stripInline).join(" ");
        default:
          return "";
      }
    })
    .join("\n")
    .trim();
}

export function wordCount(source: string): number {
  return plainText(source).split(/\s+/).filter(Boolean).length;
}

/** About 200 words a minute, at least 1 minute. */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.round(wordCount(source) / 200));
}

export function headingsOf(blocks: Block[]) {
  return blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading");
}

export type Faq = { question: string; answer: string };

export function parseFaqs(value: unknown): Faq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Faq => !!f && typeof f === "object" && typeof (f as Faq).question === "string" && typeof (f as Faq).answer === "string")
    .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    .filter((f) => f.question && f.answer);
}
