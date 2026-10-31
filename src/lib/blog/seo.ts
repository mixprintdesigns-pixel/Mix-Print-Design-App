// Blog SEO rules shared by the admin editor (live counters and checklist) and the public pages (auto values).
import { parseBlocks, parseInline, plainText, wordCount, type Inline } from "./content";

export const SEO_TITLE_IDEAL = 60;
export const SEO_TITLE_MAX = 70;
export const META_DESCRIPTION_MAX = 160;
export const MIN_WORDS = 800;
export const SITE_SUFFIX = " | Mix Print Design";

/** SEO title: the admin's, else the article title (with the site name when it fits). */
export function autoSeoTitle(post: { seoTitle?: string | null; title: string }): string {
  if (post.seoTitle?.trim()) return post.seoTitle.trim();
  const title = post.title.trim();
  return title.length + SITE_SUFFIX.length <= SEO_TITLE_MAX ? `${title}${SITE_SUFFIX}` : title.slice(0, SEO_TITLE_MAX);
}

/** Cuts text at a word boundary to fit `max` characters. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,.;:]+$/, "")}…`;
}

/** Meta description: the admin's, else the excerpt, else the start of the article. */
export function autoMetaDescription(post: { seoDescription?: string | null; excerpt?: string | null; content: string }): string {
  if (post.seoDescription?.trim()) return post.seoDescription.trim();
  return clip(post.excerpt?.trim() || plainText(post.content), META_DESCRIPTION_MAX);
}

/** Social share image: the admin's, else the cover. */
export function autoShareImage(post: { ogImageUrl?: string | null; coverUrl?: string | null }): string | null {
  return post.ogImageUrl?.trim() || post.coverUrl || null;
}

function linksIn(nodes: Inline[]): string[] {
  return nodes.flatMap((n) => (n.type === "link" ? [n.href, ...linksIn(n.children)] : n.type === "strong" || n.type === "em" ? linksIn(n.children) : []));
}

/** Every link href in the article. */
export function articleLinks(content: string): string[] {
  return parseBlocks(content).flatMap((b) => {
    const texts = b.type === "paragraph" || b.type === "quote" || b.type === "heading" ? [b.text] : b.type === "list" ? b.items : b.type === "table" ? [...b.header, ...b.rows.flat()] : [];
    return texts.flatMap((t) => linksIn(parseInline(t)));
  });
}

export function isInternalLink(href: string, siteUrl = ""): boolean {
  return href.startsWith("/") || (!!siteUrl && href.startsWith(siteUrl));
}

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const contains = (text: string, keyword: string) => {
  const k = words(keyword).join(" ");
  return !!k && ` ${words(text).join(" ")} `.includes(` ${k} `);
};

export type ChecklistInput = {
  title: string;
  slug: string;
  seoTitle?: string | null;
  focusKeyword?: string | null;
  content: string;
  coverUrl?: string | null;
  coverAlt?: string | null;
};

export type CheckItem = { label: string; ok: boolean };

/** The editor's SEO checklist. */
export function seoChecklist(post: ChecklistInput, siteUrl = ""): CheckItem[] {
  const keyword = post.focusKeyword?.trim() ?? "";
  const blocks = parseBlocks(post.content);
  const firstParagraph = blocks.find((b) => b.type === "paragraph");
  const images = blocks.filter((b) => b.type === "image");
  const count = wordCount(post.content);
  return [
    { label: "Focus keyword is set", ok: !!keyword },
    { label: "Keyword in the SEO title", ok: !!keyword && contains(autoSeoTitle(post), keyword) },
    { label: "Keyword in the first paragraph", ok: !!keyword && !!firstParagraph && contains(firstParagraph.text, keyword) },
    { label: "Keyword in the URL", ok: !!keyword && contains(post.slug.replace(/-/g, " "), keyword) },
    { label: "Every image has alt text", ok: (!post.coverUrl || !!post.coverAlt?.trim()) && images.every((i) => i.alt.trim()) },
    { label: `At least ${MIN_WORDS} words (now ${count})`, ok: count >= MIN_WORDS },
    { label: "Links to other pages on the site", ok: articleLinks(post.content).some((h) => isInternalLink(h, siteUrl)) },
  ];
}
