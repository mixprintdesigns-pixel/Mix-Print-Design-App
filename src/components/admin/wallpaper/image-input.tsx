"use client";

import { useState } from "react";
import { prepareBlogImage } from "@/components/admin/blog/prepare-image";

/**
 * A file box that makes the chosen picture small in the browser first (WebP, ≤ 1600 px), so even big photos
 * upload quickly. The server then resizes to ≤ 1500 px and adds the watermark.
 */
export function SmallImageInput({ name = "image", label }: { name?: string; label: string }) {
  const [note, setNote] = useState("");
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        className="input"
        required
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          setNote("Preparing…");
          const small = await prepareBlogImage(file, "inline");
          const list = new DataTransfer();
          list.items.add(small);
          input.files = list.files;
          setNote(`${Math.round(small.size / 1024)} KB, ready to upload`);
        }}
      />
      {note && <span className="mt-1 block text-xs text-muted">{note}</span>}
    </label>
  );
}
