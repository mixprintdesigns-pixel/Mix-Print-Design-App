"use client";

import { useState, useTransition } from "react";
import { saveProductVideoAction } from "@/app/admin/product-video-actions";
import { parseYouTubeUrl, youTubeThumbnail, type VideoPosition } from "@/lib/youtube";

/** "YouTube video link (optional)" in the product's Images area: paste, preview, choose the position, save or remove. */
const POSITIONS: { value: VideoPosition; label: string }[] = [
  { value: "LAST", label: "After all images (last)" },
  { value: "AFTER_FIRST", label: "After the first image" },
  { value: "FIRST", label: "Show video first (main item)" },
];

export function ProductVideoField({ productId, initialUrl, initialPosition }: { productId: string; initialUrl: string | null; initialPosition: VideoPosition }) {
  const [link, setLink] = useState(initialUrl ?? "");
  const [position, setPosition] = useState<VideoPosition>(initialPosition);
  const [saved, setSaved] = useState({ url: initialUrl ?? "", position: initialPosition });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const video = parseYouTubeUrl(link);
  const invalid = link.trim() !== "" && !video;
  const changed = link.trim() !== saved.url || position !== saved.position;

  function save(nextLink: string, nextPosition: VideoPosition) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveProductVideoAction(productId, nextLink, nextPosition);
        if (!result.ok) {
          setMessage({ kind: "error", text: result.error });
          return;
        }
        setLink(result.url ?? "");
        setPosition(nextPosition);
        setSaved({ url: result.url ?? "", position: nextPosition });
        setMessage({ kind: "ok", text: result.url ? "Video saved. It now shows in the product's gallery." : "Video removed." });
      } catch (e) {
        setMessage({ kind: "error", text: `Could not save: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="product-video">
      <label className="block">
        <span className="label">YouTube video link (optional)</span>
        <input
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…  or  https://youtu.be/…  or  https://youtube.com/shorts/…"
          value={link}
          maxLength={500}
          onChange={(e) => {
            setLink(e.target.value);
            setMessage(null);
          }}
          aria-invalid={invalid || undefined}
        />
      </label>
      {invalid && (
        <p className="field-error" role="alert">
          This is not a YouTube video link. Paste the link from YouTube&apos;s Share button.
        </p>
      )}
      {video && (
        <div className="flex flex-wrap items-start gap-3">
          <span className="relative block w-40 shrink-0 overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youTubeThumbnail(video.id)} alt="Video preview" className="aspect-video w-full object-cover" loading="lazy" data-testid="video-preview" />
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white">▶</span>
            </span>
          </span>
          <div className="space-y-2 text-sm">
            <p className="text-muted">{video.isShort ? "YouTube Short (upright video)" : "YouTube video"}</p>
            <fieldset className="space-y-1">
              <legend className="sr-only">Where the video shows</legend>
              {POSITIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2">
                  <input type="radio" name={`video-position-${productId}`} checked={position === p.value} onChange={() => setPosition(p.value)} />
                  {p.label}
                </label>
              ))}
            </fieldset>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || invalid || !changed || (!video && !saved.url)} onClick={() => save(link, position)}>
          {pending ? "Saving…" : "Save video"}
        </button>
        {saved.url && (
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm text-red-700 dark:text-red-400" disabled={pending} onClick={() => save("", "LAST")}>
            Remove video
          </button>
        )}
        {message && (
          <span role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "field-error" : "text-sm text-green-700 dark:text-green-400"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
