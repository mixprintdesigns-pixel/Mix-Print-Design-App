"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import {
  attachBlogImageAction,
  checkBlogImageUploadAction,
  saveBlogPostAction,
  uploadBlogImageAction,
  type BlogImageResult,
} from "@/app/admin/blog-actions";
import { ArticleBody } from "@/components/blog/article-body";
import { parseBlocks, readingMinutes, wordCount } from "@/lib/blog/content";
import { autoMetaDescription, autoSeoTitle, META_DESCRIPTION_MAX, SEO_TITLE_IDEAL, SEO_TITLE_MAX, seoChecklist } from "@/lib/blog/seo";
import { toSlug } from "@/lib/slug";
import { prepareBlogImage } from "./prepare-image";

export type BlogEditorValues = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string;
  tags: string;
  authorName: string;
  coverUrl: string;
  coverAlt: string;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  publishAt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogImageUrl: string;
  faqs: { question: string; answer: string }[];
  productIds: string[];
};

type Props = {
  postId: string | null;
  initial: BlogEditorValues;
  categories: { id: string; name: string }[];
  products: { id: string; name: string; category: string }[];
  directUpload: boolean;
  siteUrl: string;
  publicUrl: string | null;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)) || "unknown error";

/** Uploads one image (cover or in-article) and returns its stored WebP. */
async function uploadImage(file: File, kind: "cover" | "inline", name: string, direct: boolean): Promise<{ url: string; width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  const prepared = await prepareBlogImage(file, kind);
  let result: BlogImageResult;
  if (direct) {
    const check = await checkBlogImageUploadAction();
    if (check.error) throw new Error(check.error);
    const ext = prepared.type === "image/webp" ? "webp" : prepared.type === "image/png" ? "png" : "jpg";
    const blob = await uploadToBlob(`blog/upload-${toSlug(name).slice(0, 40) || "image"}.${ext}`, prepared, {
      access: "public",
      handleUploadUrl: "/api/admin/blog-images/upload",
      contentType: prepared.type,
    });
    result = await attachBlogImageAction(blob.url, kind, name);
  } else {
    const data = new FormData();
    data.set("file", prepared);
    data.set("kind", kind);
    data.set("name", name);
    result = await uploadBlogImageAction(data);
  }
  if (!result.ok) throw new Error(result.error);
  return result;
}

function Counter({ length, ideal, max }: { length: number; ideal: number; max: number }) {
  const tone = length > max ? "text-red-600 dark:text-red-400" : length > ideal ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400";
  return (
    <span className={`text-xs font-semibold ${tone}`} aria-live="polite">
      {length}/{ideal === max ? max : `${ideal}–${max}`}
    </span>
  );
}

function Field({ label, htmlFor, hint, error, children, extra }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
        {extra}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BlogEditor({ postId, initial, categories, products, directUpload, siteUrl, publicUrl }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(Boolean(postId));
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string; field?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inlineImage, setInlineImage] = useState<{ open: boolean; alt: string; error: string | null }>({ open: false, alt: "", error: null });
  const [productQuery, setProductQuery] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inlineFile = useRef<HTMLInputElement>(null);

  const set = <K extends keyof BlogEditorValues>(key: K, value: BlogEditorValues[K]) => setV((s) => ({ ...s, [key]: value }));
  const blocks = useMemo(() => parseBlocks(v.content), [v.content]);
  const checklist = useMemo(() => seoChecklist(v, siteUrl), [v, siteUrl]);
  const words = useMemo(() => wordCount(v.content), [v.content]);
  const fieldError = (field: string) => (result?.kind === "error" && result.field === field ? result.text : undefined);

  // ─── Toolbar ───────────────────────────────────────────────────────────────
  function edit(fn: (text: string, start: number, end: number) => { text: string; cursor: [number, number] }) {
    const el = textarea.current;
    const start = el?.selectionStart ?? v.content.length;
    const end = el?.selectionEnd ?? v.content.length;
    const next = fn(v.content, start, end);
    set("content", next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(...next.cursor);
    });
  }
  const wrap = (before: string, after: string, placeholder: string) =>
    edit((t, s, e) => {
      const selected = t.slice(s, e) || placeholder;
      return { text: t.slice(0, s) + before + selected + after + t.slice(e), cursor: [s + before.length, s + before.length + selected.length] };
    });
  const prefixLines = (prefix: (i: number) => string) =>
    edit((t, s, e) => {
      const lineStart = t.lastIndexOf("\n", s - 1) + 1;
      const lineEnd = t.indexOf("\n", e) === -1 ? t.length : t.indexOf("\n", e);
      const lines = t.slice(lineStart, lineEnd).split("\n");
      const changed = lines.map((l, i) => prefix(i) + l.replace(/^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "")).join("\n");
      return { text: t.slice(0, lineStart) + changed + t.slice(lineEnd), cursor: [lineStart, lineStart + changed.length] };
    });
  const insertBlock = (block: string) =>
    edit((t, s) => {
      const before = t.slice(0, s).replace(/\s*$/, "");
      const after = t.slice(s).replace(/^\s*/, "");
      const text = `${before}${before ? "\n\n" : ""}${block}\n\n${after}`;
      const cursor = before.length + (before ? 2 : 0) + block.length;
      return { text, cursor: [cursor, cursor] };
    });
  function addLink() {
    const url = window.prompt("Link address, e.g. /products/offset-printing or https://…");
    if (url?.trim()) wrap("[", `](${url.trim()})`, "link text");
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    const alt = inlineImage.alt.trim();
    if (!alt) {
      setInlineImage((s) => ({ ...s, error: "Write the alt text first (what the image shows)." }));
      return;
    }
    setBusy("Uploading image…");
    try {
      const img = await uploadImage(file, "inline", alt, directUpload);
      insertBlock(`![${alt.replace(/[[\]]/g, "")}](${img.url} =${img.width}x${img.height})`);
      setInlineImage({ open: false, alt: "", error: null });
    } catch (e) {
      setInlineImage((s) => ({ ...s, error: `Upload failed: ${errorText(e)}` }));
    } finally {
      setBusy(null);
      if (inlineFile.current) inlineFile.current.value = "";
    }
  }

  async function uploadInto(field: "coverUrl" | "ogImageUrl", file: File | undefined) {
    if (!file) return;
    setBusy("Uploading image…");
    setResult(null);
    try {
      const img = await uploadImage(file, "cover", v.coverAlt || v.title || "blog cover", directUpload);
      set(field, img.url);
    } catch (e) {
      setResult({ kind: "error", text: `Upload failed: ${errorText(e)}`, field });
    } finally {
      setBusy(null);
    }
  }

  function save(status?: BlogEditorValues["status"]) {
    const values = status ? { ...v, status } : v;
    if (status) set("status", status);
    setResult(null);
    startSaving(async () => {
      try {
        const res = await saveBlogPostAction(postId, { ...values, faqs: values.faqs.filter((f) => f.question.trim() && f.answer.trim()) });
        if (!res.ok) {
          setResult({ kind: "error", text: res.error, field: res.field });
          return;
        }
        set("slug", res.slug);
        setSlugEdited(true);
        if (!postId) {
          router.replace(`/admin/blog/${res.id}?created=1`);
          return;
        }
        setResult({ kind: "ok", text: values.status === "PUBLISHED" ? "Saved and published." : values.status === "SCHEDULED" ? "Saved. It will be published at the chosen time." : "Saved as a draft." });
        router.refresh();
      } catch (e) {
        setResult({ kind: "error", text: `Could not save: ${errorText(e)}` });
      }
    });
  }

  const tool = "rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50";
  const filteredProducts = products.filter((p) => !productQuery.trim() || `${p.name} ${p.category}`.toLowerCase().includes(productQuery.trim().toLowerCase()));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-6">
        {/* ─── Main ─── */}
        <section className="card space-y-4 p-5" aria-label="Article">
          <Field label="Title" htmlFor="title" error={fieldError("title")}>
            <input
              id="title"
              className="input text-lg font-semibold"
              value={v.title}
              maxLength={200}
              onChange={(e) => setV((s) => ({ ...s, title: e.target.value, slug: slugEdited ? s.slug : toSlug(e.target.value) }))}
            />
          </Field>
          <Field label="URL slug" htmlFor="slug" hint={`${siteUrl}/blog/${v.slug || "…"}`} error={fieldError("slug")}>
            <input
              id="slug"
              className="input font-mono text-sm"
              value={v.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugEdited(true);
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category" htmlFor="categoryId" error={fieldError("categoryId")}>
              <select id="categoryId" className="input" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">— No category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags (comma separated)" htmlFor="tags">
              <input id="tags" className="input" value={v.tags} maxLength={500} placeholder="business cards, lahore" onChange={(e) => set("tags", e.target.value)} />
            </Field>
            <Field label="Author" htmlFor="authorName">
              <input id="authorName" className="input" value={v.authorName} maxLength={100} onChange={(e) => set("authorName", e.target.value)} />
            </Field>
          </div>
          <Field label="Short excerpt" htmlFor="excerpt" hint="Shown on the blog cards; also used as the meta description if that is empty." error={fieldError("excerpt")} extra={<Counter length={v.excerpt.length} ideal={160} max={300} />}>
            <textarea id="excerpt" rows={2} className="input" value={v.excerpt} maxLength={300} onChange={(e) => set("excerpt", e.target.value)} />
          </Field>
        </section>

        {/* ─── Cover ─── */}
        <section className="card space-y-3 p-5" aria-labelledby="cover-heading">
          <h2 id="cover-heading" className="font-bold">
            Cover image
          </h2>
          <p className="text-xs text-muted">Saved as WebP at 1200 × 630 (also the size used when the article is shared).</p>
          {v.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.coverUrl} alt={v.coverAlt} className="aspect-[1200/630] w-full max-w-md rounded-lg border border-border object-cover" data-testid="cover-preview" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-sm">
              {v.coverUrl ? "Replace cover" : "Upload cover"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => uploadInto("coverUrl", e.target.files?.[0])} aria-label="Cover image file" />
            </label>
            {v.coverUrl && (
              <button type="button" className="text-sm font-semibold text-red-700 dark:text-red-400" onClick={() => set("coverUrl", "")}>
                Remove cover
              </button>
            )}
          </div>
          {fieldError("coverUrl") && <p className="field-error">{fieldError("coverUrl")}</p>}
          <Field label="Cover alt text (required)" htmlFor="coverAlt" hint="Describe the image, e.g. “Matte business cards on a desk”." error={fieldError("coverAlt")}>
            <input id="coverAlt" className="input" value={v.coverAlt} maxLength={200} onChange={(e) => set("coverAlt", e.target.value)} />
          </Field>
        </section>

        {/* ─── Content ─── */}
        <section className="card p-5" aria-labelledby="content-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="content-heading" className="font-bold">
              Article
            </h2>
            <div className="flex rounded-lg border border-border p-0.5 text-sm" role="tablist">
              {(["write", "preview"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`rounded-md px-3 py-1 font-semibold ${tab === t ? "bg-brand text-white" : "text-muted"}`} onClick={() => setTab(t)}>
                  {t === "write" ? "Write" : "Preview"}
                </button>
              ))}
            </div>
          </div>

          {tab === "write" ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5" role="toolbar" aria-label="Formatting">
                <button type="button" className={tool} onClick={() => prefixLines(() => "## ")}>
                  H2
                </button>
                <button type="button" className={tool} onClick={() => prefixLines(() => "### ")}>
                  H3
                </button>
                <button type="button" className={tool} onClick={() => wrap("**", "**", "bold text")} aria-label="Bold">
                  B
                </button>
                <button type="button" className={`${tool} italic`} onClick={() => wrap("*", "*", "italic text")} aria-label="Italic">
                  I
                </button>
                <button type="button" className={tool} onClick={() => prefixLines(() => "- ")}>
                  • List
                </button>
                <button type="button" className={tool} onClick={() => prefixLines((i) => `${i + 1}. `)}>
                  1. List
                </button>
                <button type="button" className={tool} onClick={addLink}>
                  Link
                </button>
                <button type="button" className={tool} onClick={() => prefixLines(() => "> ")}>
                  Quote
                </button>
                <button type="button" className={tool} onClick={() => insertBlock("| Column 1 | Column 2 |\n| --- | --- |\n| Text | Text |\n| Text | Text |")}>
                  Table
                </button>
                <button type="button" className={tool} onClick={() => setInlineImage((s) => ({ ...s, open: !s.open, error: null }))} aria-expanded={inlineImage.open}>
                  Image
                </button>
              </div>

              {inlineImage.open && (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3" data-testid="insert-image">
                  <p className="text-xs text-muted">The image is added where the cursor is, saved as WebP up to 1600 px wide.</p>
                  <label className="block">
                    <span className="label">Alt text (required)</span>
                    <input className="input" value={inlineImage.alt} maxLength={200} placeholder="What the image shows" onChange={(e) => setInlineImage((s) => ({ ...s, alt: e.target.value, error: null }))} />
                  </label>
                  <label className="btn-secondary inline-flex cursor-pointer px-3 py-1.5 text-sm">
                    Choose image and insert
                    <input ref={inlineFile} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => insertImage(e.target.files?.[0])} aria-label="Image to insert" />
                  </label>
                  {inlineImage.error && (
                    <p className="field-error" role="alert">
                      {inlineImage.error}
                    </p>
                  )}
                </div>
              )}

              <textarea
                ref={textarea}
                id="content"
                aria-label="Article text"
                rows={22}
                className="input mt-3 font-mono text-sm leading-relaxed"
                value={v.content}
                onChange={(e) => set("content", e.target.value)}
                placeholder={"Start with a short introduction that uses your focus keyword.\n\n## A heading\n\nText, **bold**, [a link](/products) …"}
              />
              <p className="mt-1 text-xs text-muted">
                {words} words · {readingMinutes(v.content)} min read · Tip: use the toolbar, or type ## for a heading, - for a list, **bold**.
              </p>
              {fieldError("content") && <p className="field-error">{fieldError("content")}</p>}
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-border p-5" data-testid="article-preview">
              <p className="text-3xl font-bold">{v.title || "Untitled article"}</p>
              {blocks.length ? <div className="mt-6"><ArticleBody blocks={blocks} /></div> : <p className="mt-4 text-muted">Nothing written yet.</p>}
            </div>
          )}
        </section>

        {/* ─── FAQ ─── */}
        <section className="card space-y-3 p-5" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-bold">
            FAQ block (optional)
          </h2>
          <p className="text-xs text-muted">Shown at the end of the article, and added for Google as FAQ structured data.</p>
          {v.faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <label className="block">
                <span className="label">Question {i + 1}</span>
                <input className="input" value={f.question} maxLength={300} onChange={(e) => set("faqs", v.faqs.map((x, k) => (k === i ? { ...x, question: e.target.value } : x)))} />
              </label>
              <label className="block">
                <span className="label">Answer {i + 1}</span>
                <textarea className="input" rows={2} value={f.answer} maxLength={2000} onChange={(e) => set("faqs", v.faqs.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)))} />
              </label>
              <button type="button" className="text-xs font-semibold text-red-700 dark:text-red-400" onClick={() => set("faqs", v.faqs.filter((_, k) => k !== i))}>
                Remove question
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => set("faqs", [...v.faqs, { question: "", answer: "" }])}>
            + Add question
          </button>
        </section>

        {/* ─── Products ─── */}
        <section className="card space-y-3 p-5" aria-labelledby="products-heading">
          <h2 id="products-heading" className="font-bold">
            Linked products
          </h2>
          <p className="text-xs text-muted">Shown on the article with image, price and an “Order now” button.</p>
          {v.productIds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {v.productIds.map((pid) => {
                const p = products.find((x) => x.id === pid);
                return (
                  <li key={pid} className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-sm">
                    {p?.name ?? "Removed product"}
                    <button type="button" aria-label={`Remove ${p?.name ?? "product"}`} className="ml-1 font-bold text-muted hover:text-foreground" onClick={() => set("productIds", v.productIds.filter((x) => x !== pid))}>
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <input className="input" placeholder="Find products" aria-label="Find products" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-sm">
            {filteredProducts.slice(0, 100).map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={v.productIds.includes(p.id)}
                    onChange={(e) => set("productIds", e.target.checked ? [...v.productIds, p.id] : v.productIds.filter((x) => x !== p.id))}
                  />
                  <span>
                    {p.name} <span className="text-xs text-muted">· {p.category}</span>
                  </span>
                </label>
              </li>
            ))}
            {filteredProducts.length === 0 && <li className="px-2 py-1 text-muted">No products found.</li>}
          </ul>
        </section>
      </div>

      {/* ─── Sidebar: publish + SEO ─── */}
      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <section className="card space-y-3 p-5" aria-labelledby="publish-heading">
          <h2 id="publish-heading" className="font-bold">
            Publish
          </h2>
          <Field label="Status" htmlFor="status">
            <select id="status" className="input" value={v.status} onChange={(e) => set("status", e.target.value as BlogEditorValues["status"])}>
              <option value="DRAFT">Draft (not on the site)</option>
              <option value="PUBLISHED">Published</option>
              <option value="SCHEDULED">Scheduled</option>
            </select>
          </Field>
          {v.status === "SCHEDULED" && (
            <Field label="Publish date and time (Pakistan time)" htmlFor="publishAt" error={fieldError("publishAt")}>
              <input id="publishAt" type="datetime-local" className="input" value={v.publishAt} onChange={(e) => set("publishAt", e.target.value)} />
            </Field>
          )}
          {result && (
            <p role={result.kind === "error" ? "alert" : "status"} className={result.kind === "error" ? "field-error" : "text-sm text-green-700 dark:text-green-400"}>
              {result.text}
            </p>
          )}
          {busy && <p className="text-sm text-muted">{busy}</p>}
          <button type="button" className="btn-primary w-full" disabled={saving || !!busy} onClick={() => save()}>
            {saving ? "Saving…" : postId ? "Save article" : "Create article"}
          </button>
          {publicUrl && (
            <Link href={publicUrl} target="_blank" className="block text-center text-sm font-semibold text-brand">
              View on the site ↗
            </Link>
          )}
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="seo-heading">
          <h2 id="seo-heading" className="font-bold">
            SEO
          </h2>
          <Field label="SEO title" htmlFor="seoTitle" hint="Empty: the title is used." error={fieldError("seoTitle")} extra={<Counter length={(v.seoTitle || autoSeoTitle(v)).length} ideal={SEO_TITLE_IDEAL} max={SEO_TITLE_MAX} />}>
            <input id="seoTitle" className="input" value={v.seoTitle} maxLength={SEO_TITLE_MAX} placeholder={autoSeoTitle({ title: v.title || "Article title" })} onChange={(e) => set("seoTitle", e.target.value)} />
          </Field>
          <Field
            label="Meta description"
            htmlFor="seoDescription"
            hint="Empty: the excerpt is used."
            error={fieldError("seoDescription")}
            extra={<Counter length={(v.seoDescription || autoMetaDescription(v)).length} ideal={META_DESCRIPTION_MAX} max={META_DESCRIPTION_MAX} />}
          >
            <textarea id="seoDescription" rows={3} className="input" value={v.seoDescription} maxLength={META_DESCRIPTION_MAX} onChange={(e) => set("seoDescription", e.target.value)} />
          </Field>
          <Field label="Focus keyword" htmlFor="focusKeyword">
            <input id="focusKeyword" className="input" value={v.focusKeyword} maxLength={80} placeholder="e.g. business card printing" onChange={(e) => set("focusKeyword", e.target.value)} />
          </Field>
          <Field label="Canonical URL (optional)" htmlFor="canonicalUrl" hint="Only if this article was first published elsewhere." error={fieldError("canonicalUrl")}>
            <input id="canonicalUrl" className="input" value={v.canonicalUrl} maxLength={500} placeholder="https://…" onChange={(e) => set("canonicalUrl", e.target.value)} />
          </Field>
          <Field label="Social share image" htmlFor="ogImageUrl" hint="Empty: the cover is used." error={fieldError("ogImageUrl")}>
            <div className="flex gap-2">
              <input id="ogImageUrl" className="input" value={v.ogImageUrl} maxLength={1000} placeholder="Uses the cover" onChange={(e) => set("ogImageUrl", e.target.value)} />
              <label className="btn-secondary shrink-0 cursor-pointer px-3 py-1.5 text-xs">
                Upload
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => uploadInto("ogImageUrl", e.target.files?.[0])} aria-label="Social share image file" />
              </label>
            </div>
          </Field>

          <div className="rounded-lg border border-border p-3" aria-label="Google preview">
            <p className="text-xs text-muted">Google preview</p>
            <p className="mt-1 truncate text-xs text-green-700 dark:text-green-400">
              {siteUrl}/blog/{v.slug || "…"}
            </p>
            <p className="truncate text-base text-[#1a0dab] dark:text-sky-400">{autoSeoTitle({ seoTitle: v.seoTitle, title: v.title || "Article title" })}</p>
            <p className="line-clamp-2 text-xs text-muted">{autoMetaDescription(v) || "The meta description appears here."}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">SEO checklist</p>
            <ul className="mt-2 space-y-1 text-sm" data-testid="seo-checklist">
              {checklist.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span aria-hidden className={c.ok ? "text-green-600" : "text-amber-600"}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <span className={c.ok ? "" : "text-muted"}>
                    {c.label}
                    <span className="sr-only">{c.ok ? " (done)" : " (to do)"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </aside>
    </div>
  );
}
