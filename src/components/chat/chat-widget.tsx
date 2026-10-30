"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BrandBadge } from "@/components/brand-logo";
import { ChatOrderForm } from "./chat-order-form";

type Message = { role: "user" | "assistant"; content: string; sources?: { title: string; url: string }[] };

const WHATSAPP = "https://wa.me/923034889255";
const STORAGE_KEY = "mp-chat";
const GREETING: Message = {
  role: "assistant",
  content: "Assalam o Alaikum! I'm the Mix Print Design assistant. Ask me about products, prices, sign boards, ordering or our affiliate program.",
};
const SUGGESTIONS = ["Business card prices?", "Do you make backlit boards?", "How does the affiliate program work?"];

/** Renders [text](url) links, **bold**, and line breaks. Everything else is plain text (no HTML injection). */
function renderText(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => {
    const parts: ReactNode[] = [];
    const pattern = /\[([^\]]+)\]\(((?:\/|https:\/\/)[^\s)]+)\)|\*\*([^*]+)\*\*/g;
    let last = 0;
    for (const match of line.matchAll(pattern)) {
      parts.push(line.slice(last, match.index));
      if (match[1]) {
        const external = match[2].startsWith("https://");
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            className="font-semibold text-brand underline"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {match[1]}
          </a>,
        );
      } else {
        parts.push(<strong key={match.index}>{match[3]}</strong>);
      }
      last = (match.index ?? 0) + match[0].length;
    }
    parts.push(line.slice(last));
    return (
      <Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </Fragment>
    );
  });
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the conversation while browsing between pages (this tab only).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after hydration
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = messages.filter((m) => m !== GREETING).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await response.json();
      setMessages((m) => [
        ...m,
        response.ok
          ? { role: "assistant", content: data.answer, sources: data.sources }
          : { role: "assistant", content: data.error ?? "Sorry, something went wrong. Please try again." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, I couldn't connect. You can reach us on [WhatsApp](${WHATSAPP}).` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Mix Print Design assistant"
          className="fixed inset-x-2 bottom-20 z-50 flex max-h-[min(36rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-5 sm:w-96"
        >
          <header className="flex items-center justify-between bg-gradient-to-r from-brand to-accent px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <BrandBadge className="h-9 w-9 shrink-0" />
              <div>
              <p className="font-bold">Mix Print Design assistant</p>
              <p className="text-xs opacity-90">Answers from our website · AI may make mistakes</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-xl leading-none hover:bg-white/20" aria-label="Close chat">
              ×
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite" data-testid="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed ${
                    m.role === "user" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-background"
                  }`}
                  data-testid={m.role === "assistant" ? "chat-answer" : "chat-question"}
                >
                  {renderText(m.content)}
                  {m.sources && m.sources.some((s) => s.url.startsWith("https://")) && (
                    <p className="mt-2 border-t border-border pt-1 text-xs text-muted">
                      Web sources:{" "}
                      {m.sources
                        .filter((s) => s.url.startsWith("https://"))
                        .map((s, j) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {j > 0 ? ", " : ""}
                            {s.title}
                          </a>
                        ))}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <p className="text-muted" role="status">
                Typing…
              </p>
            )}
            {ordering && (
              <ChatOrderForm
                onCancel={() => setOrdering(false)}
                onDone={(text) => {
                  setOrdering(false);
                  setMessages((m) => [...m, { role: "assistant", content: text }]);
                }}
              />
            )}
            {messages.length === 1 && !ordering && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!ordering && (
            <button
              type="button"
              onClick={() => setOrdering(true)}
              className="border-t border-border py-2 text-center text-xs font-semibold text-brand hover:bg-brand/5"
            >
              Place an order in this chat
            </button>
          )}
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask about products, prices, orders…"
              className="input py-2"
              aria-label="Your question"
            />
            <button className="btn-primary px-3 py-2" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="border-t border-border py-2 text-center text-xs font-semibold text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
            Prefer a person? Chat with us on WhatsApp
          </a>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-xl transition hover:scale-105 hover:bg-brand-strong sm:right-5"
        aria-label={open ? "Close chat assistant" : "Open chat assistant"}
        aria-expanded={open}
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
            <path d="M8 11h.01M12 11h.01M16 11h.01" strokeLinecap="round" strokeWidth="3" />
          </svg>
        )}
      </button>
    </>
  );
}
