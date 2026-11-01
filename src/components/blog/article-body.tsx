import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { parseInline, type Block, type Inline } from "@/lib/blog/content";

// Renders a blog article (see lib/blog/content.ts) as React elements: no raw HTML, so nothing in an
// article can run scripts. Used on the article page and in the admin editor's preview.

/** Our own images (uploads and Vercel Blob) are resized by Next.js; other https images are shown as they are. */
const optimizable = (src: string) => src.startsWith("/") || /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i.test(src);

/**
 * A link in an article (text or image). Our own pages open in the same tab and outside websites in a new one,
 * unless the editor chose otherwise; outside links always get rel="noopener noreferrer".
 */
function SmartLink({ href, newTab, className, children }: { href: string; newTab?: boolean; className?: string; children: ReactNode }) {
  const external = /^https?:/i.test(href);
  const openNew = newTab ?? external;
  if (href.startsWith("/") && !openNew) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} {...(openNew ? { target: "_blank" } : {})} {...(external ? { rel: "noopener noreferrer" } : openNew ? { rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <Fragment key={i}>{n.text}</Fragment>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <InlineNodes nodes={n.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineNodes nodes={n.children} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-surface px-1.5 py-0.5 text-[0.9em]">
                {n.text}
              </code>
            );
          case "link":
            return (
              <SmartLink key={i} href={n.href} newTab={n.newTab} className="font-medium text-brand underline underline-offset-2 hover:no-underline">
                <InlineNodes nodes={n.children} />
              </SmartLink>
            );
        }
      })}
    </>
  );
}

const text = (t: string): ReactNode => <InlineNodes nodes={parseInline(t)} />;

export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[1.0625rem] leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} id={b.id} className="scroll-mt-24 pt-4 text-2xl font-bold text-foreground">
                {text(b.text)}
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="scroll-mt-24 pt-2 text-xl font-semibold text-foreground">
                {text(b.text)}
              </h3>
            );
          case "paragraph":
            return <p key={i}>{text(b.text)}</p>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`space-y-1.5 pl-6 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-brand`}>
                {b.items.map((item, k) => (
                  <li key={k}>{text(item)}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="rounded-r-lg border-l-4 border-brand bg-surface px-4 py-3 italic">
                {text(b.text)}
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface">
                    <tr>
                      {b.header.map((h, k) => (
                        <th key={k} scope="col" className="p-3 font-semibold text-foreground">
                          {text(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r} className="border-t border-border">
                        {row.map((cell, k) => (
                          <td key={k} className="p-3 align-top">
                            {text(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "image": {
            const img = optimizable(b.src) ? (
              <Image
                src={b.src}
                alt={b.alt}
                width={b.width ?? 1600}
                height={b.height ?? 900}
                sizes="(max-width: 768px) 100vw, 768px"
                className={`h-auto w-full rounded-xl ${b.href ? "transition duration-200 group-hover:opacity-90 group-hover:shadow-lg" : ""}`}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.src}
                alt={b.alt}
                width={b.width}
                height={b.height}
                loading="lazy"
                decoding="async"
                className={`h-auto w-full rounded-xl ${b.href ? "transition duration-200 group-hover:opacity-90 group-hover:shadow-lg" : ""}`}
              />
            );
            // Older images show their alt text as the caption; images given a caption (even an empty one) show that.
            const caption = b.caption !== undefined ? b.caption : b.alt;
            return (
              <figure key={i} className="my-6">
                {b.href ? (
                  <SmartLink href={b.href} newTab={b.newTab} className="group block cursor-pointer rounded-xl">
                    {img}
                  </SmartLink>
                ) : (
                  img
                )}
                {caption && <figcaption className="mt-2 text-center text-sm text-muted">{caption}</figcaption>}
              </figure>
            );
          }
          case "rule":
            return <hr key={i} className="border-border" />;
        }
      })}
    </div>
  );
}
