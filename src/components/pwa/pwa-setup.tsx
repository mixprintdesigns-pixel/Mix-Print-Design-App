"use client";

import { useEffect, useState } from "react";

// Registers the service worker (public/sw.js) and, on Android phones, offers "Install app" once per visitor.
// The banner sits in the page flow above the header, so it never covers content, and can be dismissed.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const SHOWN_KEY = "mixprint:install-app-shown";

function alreadyShown(): boolean {
  try {
    return window.localStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return true; // storage blocked: do not nag
  }
}

export function PwaSetup() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      const isPhone = window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!isPhone || installed || alreadyShown()) return;
      e.preventDefault(); // show our own small banner instead of the browser's
      try {
        window.localStorage.setItem(SHOWN_KEY, "1");
      } catch {}
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent) return null;
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 text-sm" role="region" aria-label="Install app" data-testid="install-app-banner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
      <p className="min-w-0 flex-1 leading-tight">
        <span className="font-semibold">Mix Print Design app</span>
        <span className="block text-xs text-muted">Faster ordering from your home screen</span>
      </p>
      <button
        type="button"
        className="btn-primary shrink-0 px-3 py-1.5 text-xs"
        onClick={async () => {
          const event = installEvent;
          setInstallEvent(null);
          await event.prompt().catch(() => {});
        }}
      >
        Install app
      </button>
      <button type="button" className="shrink-0 px-1 text-lg leading-none text-muted hover:text-foreground" aria-label="Close" onClick={() => setInstallEvent(null)}>
        ×
      </button>
    </div>
  );
}
