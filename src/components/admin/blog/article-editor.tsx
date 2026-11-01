"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EditorContent,
  Extension,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type Editor,
  type ReactNodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { ArticleBody } from "@/components/blog/article-body";
import { parseBlocks, readingMinutes, wordCount } from "@/lib/blog/content";
import { docToMarkdown, looksLikeMarkdown, markdownToDoc, type DocNode } from "@/lib/blog/editor-format";

// The Article box of the admin blog editor: a visual (WYSIWYG) editor. Articles are still stored in the
// same format (lib/blog/content.ts); lib/blog/editor-format.ts converts to and from the editor's document.

export type LinkTarget = { group: string; label: string; href: string };

type Props = {
  value: string;
  /** Shown above the text in Preview. */
  title?: string;
  onChange: (markdown: string) => void;
  /** Used to keep an autosaved copy of unsaved text on this device. */
  postId: string | null;
  /** Uploads an image for the article (WebP, max 1600 px) and returns it. */
  uploadImage: (file: File, alt: string) => Promise<{ url: string; width: number; height: number }>;
  linkTargets: LinkTarget[];
  error?: string;
};

const isOwnPage = (href: string) => href.startsWith("/") || href.startsWith("#");
const defaultNewTab = (href: string) => !isOwnPage(href) && /^https?:/i.test(href);

// ─── Image with alt text, optional caption and optional link ─────────────────

function ImageView({ node, selected }: ReactNodeViewProps) {
  const { src, alt, caption, href } = node.attrs as {
    src: string;
    alt: string;
    caption: string | null;
    href: string | null;
  };
  const shown = caption !== null ? caption : alt;
  return (
    <NodeViewWrapper as="figure" className="my-6" data-drag-handle>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`h-auto w-full rounded-xl ${selected ? "outline outline-4 outline-brand/60" : ""} ${href ? "cursor-pointer" : ""}`}
        draggable={false}
      />
      {(shown || href) && (
        <figcaption className="mt-2 text-center text-sm text-muted">
          {shown}
          {href && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">🔗 {href}</span>}
        </figcaption>
      )}
      {!alt.trim() && (
        <span className="mt-1 block text-center text-xs font-semibold text-red-600">Alt text missing: click the image and add it below the toolbar.</span>
      )}
    </NodeViewWrapper>
  );
}

const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
      caption: { default: null },
      href: { default: null },
      target: { default: null },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

/** Pasted HTML (Google Docs, Word, ChatGPT): keep structure, drop fonts, colours and the page title level. */
function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const unwrap = (el: Element) => el.replaceWith(...Array.from(el.childNodes));
  const rename = (el: Element, tag: string) => {
    const next = doc.createElement(tag);
    next.append(...Array.from(el.childNodes));
    el.replaceWith(next);
    return next;
  };
  // Google Docs wraps everything in a <b style="font-weight:normal">: not bold at all.
  doc.querySelectorAll('b[id^="docs-internal-guid"], b[style*="font-weight:normal"], b[style*="font-weight: normal"]').forEach(unwrap);
  // The page title is the only H1; deeper levels become H3.
  doc.querySelectorAll("h1").forEach((h) => rename(h, "h2"));
  doc.querySelectorAll("h4, h5, h6").forEach((h) => rename(h, "h3"));
  // Bold and italic set as styles (Google Docs, Word) become real bold and italic.
  doc.querySelectorAll<HTMLElement>("span[style], font[style]").forEach((el) => {
    const weight = el.style.fontWeight;
    let inner: Element = el;
    if (weight === "bold" || weight === "bolder" || Number(weight) >= 600) {
      const strong = doc.createElement("strong");
      strong.append(...Array.from(inner.childNodes));
      inner.append(strong);
      inner = strong;
    }
    if (el.style.fontStyle === "italic") {
      const em = doc.createElement("em");
      em.append(...Array.from(inner.childNodes));
      inner.append(em);
    }
  });
  // Fonts, colours, sizes and classes are dropped.
  doc.querySelectorAll("span, font").forEach(unwrap);
  doc.querySelectorAll("[style], [class], [color], [face], [size], [lang], [dir]").forEach((el) => {
    for (const attr of ["style", "class", "color", "face", "size", "lang", "dir"]) el.removeAttribute(attr);
  });
  return doc.body.innerHTML;
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolButton({
  label,
  title,
  active,
  disabled,
  onRun,
  className = "",
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onRun: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the cursor and selection in the text: the editor never loses focus, so nothing scrolls.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={`min-w-8 rounded-md px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${active ? "bg-brand text-white" : "hover:bg-surface"} ${className}`}
    >
      {label}
    </button>
  );
}

// ─── Link picker (text and images) ───────────────────────────────────────────

function LinkPicker({
  targets,
  initialHref,
  initialNewTab,
  forImage,
  onApply,
  onRemove,
  onClose,
}: {
  targets: LinkTarget[];
  initialHref: string;
  initialNewTab: boolean | null;
  forImage: boolean;
  onApply: (href: string, newTab: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [href, setHref] = useState(initialHref);
  const [newTab, setNewTab] = useState(initialNewTab ?? defaultNewTab(initialHref));
  const [tabTouched, setTabTouched] = useState(initialNewTab !== null);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = targets.filter((t) => !q || `${t.group} ${t.label} ${t.href}`.toLowerCase().includes(q)).slice(0, 60);
  const groups = [...new Set(matches.map((m) => m.group))];

  const choose = (value: string) => {
    setHref(value);
    setError(null);
    if (!tabTouched) setNewTab(defaultNewTab(value));
  };
  const apply = () => {
    let value = href.trim();
    if (/^www\./i.test(value) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) value = `https://${value}`;
    if (!/^(https?:\/\/|\/|#|mailto:|tel:)\S+$/i.test(value)) {
      setError("Choose a page from the list, or paste a full link starting with https://, / or tel:");
      return;
    }
    onApply(value, newTab);
  };

  return (
    <div
      className="mt-3 space-y-3 rounded-lg border border-brand/40 bg-surface p-3"
      role="dialog"
      aria-label={forImage ? "Link for the image" : "Link"}
      data-testid="link-picker"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{forImage ? "Link the image to…" : "Link to…"}</p>
        <button type="button" className="text-xs font-semibold text-muted hover:text-foreground" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        className="input"
        placeholder="Search products, services, articles…"
        aria-label="Search pages to link"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background p-1 text-sm">
        {groups.length === 0 && <p className="p-2 text-muted">Nothing found. You can paste a link below.</p>}
        {groups.map((g) => (
          <div key={g}>
            <p className="px-2 pt-2 text-xs font-bold uppercase tracking-widest text-muted">{g}</p>
            {matches
              .filter((m) => m.group === g)
              .map((m) => (
                <button
                  key={`${g}:${m.href}:${m.label}`}
                  type="button"
                  onClick={() => choose(m.href)}
                  className={`block w-full rounded px-2 py-1.5 text-left hover:bg-surface ${href === m.href ? "bg-brand/10 font-semibold" : ""}`}
                >
                  {m.label} <span className="text-xs text-muted">{m.href.length > 60 ? `${m.href.slice(0, 60)}…` : m.href}</span>
                </button>
              ))}
          </div>
        ))}
      </div>
      <label className="block">
        <span className="label">Link address (or paste any URL)</span>
        <input
          className="input font-mono text-sm"
          value={href}
          placeholder="/products/… or https://…"
          onChange={(e) => choose(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={newTab}
          onChange={(e) => {
            setTabTouched(true);
            setNewTab(e.target.checked);
          }}
        />
        Open in a new tab
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-4 py-1.5 text-sm" onClick={apply}>
          Apply link
        </button>
        {initialHref && (
          <button type="button" className="btn-secondary px-4 py-1.5 text-sm text-red-700 dark:text-red-400" onClick={onRemove}>
            Remove link
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Autosave (on this device) ───────────────────────────────────────────────

type Autosave = { base: string; content: string; at: number };
const autosaveKey = (postId: string | null) => `mixprint:blog-article:${postId ?? "new"}`;
function readAutosave(key: string): Autosave | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Autosave) : null;
  } catch {
    return null;
  }
}

// ─── The editor ──────────────────────────────────────────────────────────────

const typography = [
  "min-h-[26rem] px-4 py-5 sm:px-6 text-[1.0625rem] leading-relaxed text-foreground/90 outline-none",
  "[&>*+*]:mt-5 [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:pt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-1.5 [&_li]:marker:text-brand",
  "[&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-brand [&_blockquote]:bg-surface [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:text-sm",
  "[&_th]:bg-surface [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_td]:border-t [&_td]:border-border [&_td]:p-3 [&_td]:align-top [&_th_p]:m-0 [&_td_p]:m-0 [&_.selectedCell]:bg-brand/10",
  "[&_hr]:border-border [&_.ProseMirror-selectednode]:outline-none",
].join(" ");

export function ArticleEditor({ value, title, onChange, postId, uploadImage, linkTargets, error }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [linkPicker, setLinkPicker] = useState<null | {
    href: string;
    newTab: boolean | null;
    forImage: boolean;
  }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imagePanel, setImagePanel] = useState<{
    open: boolean;
    alt: string;
    error: string | null;
    busy: boolean;
  }>({ open: false, alt: "", error: null, busy: false });
  const [restore, setRestore] = useState<Autosave | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initial = useRef(value);
  const lastEmitted = useRef(value);
  const openLinkRef = useRef<() => void>(() => {});
  const key = autosaveKey(postId);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          HTMLAttributes: { target: null, rel: null, class: null },
        },
      }),
      ArticleImage.configure({ allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Extension.create({
        name: "articleShortcuts",
        addKeyboardShortcuts: () => ({
          "Mod-k": () => {
            openLinkRef.current();
            return true;
          },
        }),
      }),
    ],
    content: markdownToDoc(value),
    editorProps: {
      attributes: {
        class: typography,
        "aria-label": "Article text",
        "aria-multiline": "true",
        role: "textbox",
        "data-testid": "article-editor",
      },
      transformPastedHTML: cleanPastedHtml,
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData("text/html");
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (html || !looksLikeMarkdown(text)) return false;
        // Markdown copied as plain text (e.g. from ChatGPT): paste it formatted, not as ## and **.
        const doc = markdownToDoc(text);
        editorRef.current
          ?.chain()
          .insertContent(doc.content ?? [])
          .run();
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = docToMarkdown(e.getJSON() as DocNode);
      lastEmitted.current = md;
      onChange(md);
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            table: e.isActive("table"),
            image: e.isActive("image"),
            imageAttrs: e.isActive("image")
              ? (e.getAttributes("image") as {
                  alt: string;
                  caption: string | null;
                  href: string | null;
                  target: string | null;
                })
              : null,
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  /** Runs a command without moving the page: the cursor stays where it was. */
  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (!editor) return;
    fn(editor.chain().focus(undefined, { scrollIntoView: false })).run();
  };

  // ─── Links ─────────────────────────────────────────────────────────────────
  function openLink() {
    if (!editor) return;
    setNotice(null);
    if (editor.isActive("image")) {
      const a = editor.getAttributes("image");
      setLinkPicker({
        href: a.href ?? "",
        newTab: a.target === "_blank" ? true : a.target === "_self" ? false : null,
        forImage: true,
      });
      return;
    }
    const a = editor.getAttributes("link");
    if (editor.state.selection.empty && !a.href) {
      setNotice("Select some words or click an image first, then choose Link.");
      return;
    }
    setLinkPicker({
      href: a.href ?? "",
      newTab: a.target === "_blank" ? true : a.target === "_self" ? false : null,
      forImage: false,
    });
  }
  openLinkRef.current = openLink;

  function applyLink(href: string, newTab: boolean) {
    const target = newTab ? "_blank" : "_self";
    if (linkPicker?.forImage) run((c) => c.updateAttributes("image", { href, target }));
    else run((c) => c.extendMarkRange("link").setLink({ href, target }));
    setLinkPicker(null);
  }
  function removeLink() {
    if (linkPicker?.forImage) run((c) => c.updateAttributes("image", { href: null, target: null }));
    else run((c) => c.extendMarkRange("link").unsetLink());
    setLinkPicker(null);
  }

  // ─── Images ────────────────────────────────────────────────────────────────
  async function insertImage(file: File | undefined) {
    if (!file || !editor) return;
    const alt = imagePanel.alt.trim();
    if (!alt) {
      setImagePanel((s) => ({
        ...s,
        error: "Write the alt text first (what the image shows).",
      }));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setImagePanel((s) => ({ ...s, busy: true, error: null }));
    try {
      const img = await uploadImage(file, alt);
      run((c) =>
        c.insertContent({
          type: "image",
          attrs: {
            src: img.url,
            alt,
            width: img.width,
            height: img.height,
            caption: "",
          },
        }),
      );
      setImagePanel({ open: false, alt: "", error: null, busy: false });
    } catch (e) {
      setImagePanel((s) => ({
        ...s,
        busy: false,
        error: `Upload failed: ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const setImageAttr = (attrs: Record<string, unknown>) => editor?.chain().updateAttributes("image", attrs).run();

  // ─── Autosave on this device, and outside changes ─────────────────────────
  useEffect(() => {
    const saved = readAutosave(key);
    if (saved && saved.base === initial.current && saved.content !== initial.current) setRestore(saved);
    else if (saved) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  }, [key]);

  useEffect(() => {
    if (value === initial.current) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            base: initial.current,
            content: value,
            at: Date.now(),
          } satisfies Autosave),
        );
        setSavedAt(Date.now());
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [value, key]);

  // The text was replaced from outside (e.g. restored): show it in the editor.
  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(markdownToDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);

  const words = useMemo(() => wordCount(value), [value]);
  const blocks = useMemo(() => (tab === "preview" ? parseBlocks(value) : []), [tab, value]);
  const s = state;
  const sep = <span aria-hidden className="mx-0.5 h-5 w-px self-center bg-border" />;

  return (
    <section className="card p-5" aria-labelledby="content-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="content-heading" className="font-bold">
          Article
        </h2>
        <div className="flex rounded-lg border border-border p-0.5 text-sm" role="tablist">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`rounded-md px-3 py-1 font-semibold ${tab === t ? "bg-brand text-white" : "text-muted"}`}
              onClick={() => setTab(t)}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      {restore && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          Unsaved text from {new Date(restore.at).toLocaleString("en-PK")} was found on this device.
          <button
            type="button"
            className="btn-primary px-3 py-1 text-xs"
            onClick={() => {
              onChange(restore.content);
              setRestore(null);
            }}
          >
            Restore it
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1 text-xs"
            onClick={() => {
              try {
                window.localStorage.removeItem(key);
              } catch {}
              setRestore(null);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <div className={tab === "write" ? "mt-3" : "hidden"}>
        <div className="rounded-lg border border-border bg-background">
          {/* Sticky under the site header, so the tools stay in reach on long articles. */}
          <div className="sticky top-16 z-20 rounded-t-lg border-b border-border bg-surface/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-0.5 p-1.5" role="toolbar" aria-label="Formatting">
              <ToolButton label="H2" title="Heading (H2)" active={s?.h2} onRun={() => run((c) => c.toggleHeading({ level: 2 }))} />
              <ToolButton label="H3" title="Sub-heading (H3)" active={s?.h3} onRun={() => run((c) => c.toggleHeading({ level: 3 }))} />
              {sep}
              <ToolButton label={<b>B</b>} title="Bold (Ctrl+B)" active={s?.bold} onRun={() => run((c) => c.toggleBold())} />
              <ToolButton label={<i>I</i>} title="Italic (Ctrl+I)" active={s?.italic} onRun={() => run((c) => c.toggleItalic())} />
              <ToolButton label="⌫ Format" title="Remove formatting" onRun={() => run((c) => c.unsetAllMarks().clearNodes())} />
              {sep}
              <ToolButton label="• List" title="Bullet list" active={s?.bullet} onRun={() => run((c) => c.toggleBulletList())} />
              <ToolButton label="1. List" title="Numbered list" active={s?.ordered} onRun={() => run((c) => c.toggleOrderedList())} />
              <ToolButton label="❝ Quote" title="Quote" active={s?.quote} onRun={() => run((c) => c.toggleBlockquote())} />
              {sep}
              <ToolButton label="🔗 Link" title="Link (Ctrl+K)" active={s?.link || !!s?.imageAttrs?.href} onRun={openLink} />
              <ToolButton
                label="▦ Table"
                title="Insert table"
                active={s?.table}
                onRun={() => run((c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true }))}
              />
              <ToolButton
                label="🖼 Image"
                title="Insert image"
                active={imagePanel.open}
                onRun={() => setImagePanel((p) => ({ ...p, open: !p.open, error: null }))}
              />
              {sep}
              <ToolButton label="↶" title="Undo (Ctrl+Z)" disabled={!s?.canUndo} onRun={() => run((c) => c.undo())} />
              <ToolButton label="↷" title="Redo (Ctrl+Shift+Z)" disabled={!s?.canRedo} onRun={() => run((c) => c.redo())} />
              {s?.table && (
                <span className="flex flex-wrap items-center gap-0.5 border-l border-border pl-1" aria-label="Table tools">
                  <ToolButton label="+ Row" title="Add a row below" onRun={() => run((c) => c.addRowAfter())} />
                  <ToolButton label="+ Column" title="Add a column" onRun={() => run((c) => c.addColumnAfter())} />
                  <ToolButton label="− Row" title="Delete this row" onRun={() => run((c) => c.deleteRow())} />
                  <ToolButton label="− Column" title="Delete this column" onRun={() => run((c) => c.deleteColumn())} />
                  <ToolButton label="Delete table" title="Delete table" onRun={() => run((c) => c.deleteTable())} className="text-red-700 dark:text-red-400" />
                </span>
              )}
            </div>
            {/* Panels float right under the toolbar: in view wherever you are, and the text underneath never moves. */}
            <div className="absolute inset-x-0 top-full max-h-[60vh] space-y-3 overflow-y-auto border-b border-border bg-surface px-3 pb-3 shadow-lg empty:hidden">
              {notice && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-400" role="status">
                  {notice}
                </p>
              )}
              {imagePanel.open && (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3" data-testid="insert-image">
                  <p className="text-xs text-muted">The image goes where the cursor is, saved as WebP up to 1600 px wide.</p>
                  <label className="block">
                    <span className="label">Alt text (required)</span>
                    <input
                      className="input"
                      value={imagePanel.alt}
                      maxLength={200}
                      placeholder="What the image shows"
                      onChange={(e) =>
                        setImagePanel((p) => ({
                          ...p,
                          alt: e.target.value,
                          error: null,
                        }))
                      }
                    />
                  </label>
                  <label className={`btn-secondary inline-flex cursor-pointer px-3 py-1.5 text-sm ${imagePanel.busy ? "opacity-60" : ""}`}>
                    {imagePanel.busy ? "Uploading…" : "Choose image and insert"}
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={imagePanel.busy}
                      onChange={(e) => insertImage(e.target.files?.[0])}
                      aria-label="Image to insert"
                    />
                  </label>
                  {imagePanel.error && (
                    <p className="field-error" role="alert">
                      {imagePanel.error}
                    </p>
                  )}
                </div>
              )}
              {s?.imageAttrs && !linkPicker && (
                <div className="mt-3 grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2" data-testid="image-settings">
                  <p className="text-sm font-semibold sm:col-span-2">Selected image</p>
                  <label className="block">
                    <span className="label">Alt text (required)</span>
                    <input className="input" value={s.imageAttrs.alt ?? ""} maxLength={200} onChange={(e) => setImageAttr({ alt: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Caption (optional)</span>
                    <input
                      className="input"
                      value={s.imageAttrs.caption ?? s.imageAttrs.alt ?? ""}
                      maxLength={200}
                      placeholder="Shown under the image"
                      onChange={(e) => setImageAttr({ caption: e.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
                    {s.imageAttrs.href ? (
                      <>
                        <span className="text-muted">
                          Opens <span className="font-mono">{s.imageAttrs.href}</span>
                        </span>
                        <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={openLink}>
                          Change link
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={openLink}>
                        🔗 Add a link to this image
                      </button>
                    )}
                  </div>
                </div>
              )}
              {linkPicker && (
                <LinkPicker
                  key={`${linkPicker.forImage}:${linkPicker.href}`}
                  targets={linkTargets}
                  initialHref={linkPicker.href}
                  initialNewTab={linkPicker.newTab}
                  forImage={linkPicker.forImage}
                  onApply={applyLink}
                  onRemove={removeLink}
                  onClose={() => setLinkPicker(null)}
                />
              )}
            </div>
          </div>

          {editor ? <EditorContent editor={editor} /> : <div className="min-h-[26rem] animate-pulse" aria-hidden />}
        </div>
      </div>

      {tab === "preview" && (
        <div className="mt-4 rounded-lg border border-border p-5" data-testid="article-preview">
          <p className="text-3xl font-bold">{title || "Untitled article"}</p>
          {blocks.length ? (
            <div className="mt-6">
              <ArticleBody blocks={blocks} />
            </div>
          ) : (
            <p className="mt-4 text-muted">Nothing written yet.</p>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        {words} words · {readingMinutes(value)} min read
        {savedAt && (
          <>
            {" "}
            · Draft kept on this device{" "}
            {new Date(savedAt).toLocaleTimeString("en-PK", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </>
        )}{" "}
        · Shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+K link, Ctrl+Z undo
      </p>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
