"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductImageAltAction,
  uploadProductImageAction,
  type AdminResult,
} from "@/app/admin/actions";

type ProductImage = { id: string; url: string; alt: string };

export function ImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const report = (result: AdminResult, ok?: string) =>
    setMessage(result.error ? { kind: "error", text: result.error } : ok ? { kind: "ok", text: ok } : null);

  function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    startTransition(async () => {
      const failures: string[] = [];
      // One file per request keeps each upload under the server's size limit.
      for (const [i, file] of list.entries()) {
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        const data = new FormData();
        data.set("productId", productId);
        data.set("file", file);
        const result = await uploadProductImageAction(data);
        if (result.error) failures.push(`${file.name}: ${result.error}`);
      }
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage(
        failures.length
          ? { kind: "error", text: failures.join(" ") }
          : { kind: "ok", text: `${list.length} image${list.length > 1 ? "s" : ""} uploaded.` },
      );
    });
  }

  function reorder(ids: string[], ok: string) {
    startTransition(async () => report(await reorderProductImagesAction(productId, ids), ok));
  }

  const ids = images.map((i) => i.id);
  const moveTo = (from: number, to: number) => {
    const next = [...ids];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    return next;
  };

  return (
    <section className="card space-y-4 p-5" aria-labelledby="images-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="images-heading" className="text-lg font-bold">
            Images
          </h2>
          <p className="text-sm text-muted">The first image is the main image. JPG, PNG or WebP, up to 4 MB each.</p>
        </div>
        <label className="btn-primary cursor-pointer">
          {pending && progress ? progress : "Upload images"}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={pending}
            onChange={(e) => upload(e.target.files)}
            data-testid="image-upload"
          />
        </label>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "field-error" : "text-sm text-green-700 dark:text-green-400"}
        >
          {message.text}
        </p>
      )}

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">No images yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.id} className="rounded-lg border border-border p-3" data-testid="admin-image">
              <div className="relative aspect-[4/3] overflow-hidden rounded bg-background">
                <Image src={image.url} alt={image.alt} fill sizes="300px" className="object-cover" unoptimized={image.url.endsWith(".svg")} />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">Main image</span>
                )}
              </div>
              <form
                className="mt-2 flex gap-2"
                action={(data) => {
                  startTransition(async () =>
                    report(await updateProductImageAltAction(productId, image.id, String(data.get("alt") ?? "")), "Description saved."),
                  );
                }}
              >
                <input name="alt" defaultValue={image.alt} aria-label="Image description" className="input py-1.5 text-xs" />
                <button className="btn-secondary px-2 py-1.5 text-xs" disabled={pending}>
                  Save
                </button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                <button type="button" className="btn-secondary px-2 py-1" disabled={pending || i === 0} onClick={() => reorder(moveTo(i, 0), "Main image updated.")}>
                  Make main
                </button>
                <button type="button" className="btn-secondary px-2 py-1" aria-label="Move earlier" disabled={pending || i === 0} onClick={() => reorder(moveTo(i, i - 1), "Order saved.")}>
                  ←
                </button>
                <button
                  type="button"
                  className="btn-secondary px-2 py-1"
                  aria-label="Move later"
                  disabled={pending || i === images.length - 1}
                  onClick={() => reorder(moveTo(i, i + 1), "Order saved.")}
                >
                  →
                </button>
                <button
                  type="button"
                  className="btn-secondary ml-auto px-2 py-1 text-red-600"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this image?")) return;
                    startTransition(async () => report(await deleteProductImageAction(productId, image.id), "Image deleted."));
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
