import { readingMinutes } from "@/lib/blog/content";
import { getPublishedPostsForFeeds, postDate } from "@/lib/blog/queries";
import { autoMetaDescription } from "@/lib/blog/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

// RSS feed of published articles at /blog/rss.xml.

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export async function GET(): Promise<Response> {
  const posts = (await getPublishedPostsForFeeds()).slice(0, 50);
  const items = posts
    .map((p) => {
      const url = absoluteUrl(`/blog/${p.slug}`);
      return [
        "<item>",
        `<title>${escapeXml(p.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${postDate(p).toUTCString()}</pubDate>`,
        `<dc:creator>${escapeXml(p.authorName)}</dc:creator>`,
        ...(p.category ? [`<category>${escapeXml(p.category.name)}</category>`] : []),
        `<description>${escapeXml(`${autoMetaDescription({ excerpt: p.excerpt, content: p.content })} (${readingMinutes(p.content)} min read)`)}</description>`,
        ...(p.coverUrl ? [`<enclosure url="${escapeXml(absoluteUrl(p.coverUrl))}" type="image/webp" length="0" />`] : []),
        "</item>",
      ].join("");
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>${escapeXml(`${SITE_NAME} Blog`)}</title>
<link>${absoluteUrl("/blog")}</link>
<atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml" />
<description>Printing tips and guides from ${escapeXml(SITE_NAME)}, Lahore.</description>
<language>en-pk</language>
${posts[0] ? `<lastBuildDate>${postDate(posts[0]).toUTCString()}</lastBuildDate>` : ""}
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
