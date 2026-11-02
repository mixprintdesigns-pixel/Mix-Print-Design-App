// YouTube links for product videos: reads every common link format, and builds the thumbnail,
// privacy-friendly embed (youtube-nocookie.com) and watch addresses. Safe on the server and in the browser.

export type YouTubeVideo = { id: string; isShort: boolean };

const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * youtube.com/watch?v=ID, m.youtube.com, music.youtube.com, youtu.be/ID, youtube.com/shorts/ID,
 * /embed/ID, /live/ID, /v/ID, youtube-nocookie.com/embed/ID, with or without https:// and extra parameters.
 * Returns null for anything that is not a YouTube video link.
 */
export function parseYouTubeUrl(input: string | null | undefined): YouTubeVideo | null {
  const text = input?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let isShort = false;
  if (host === "youtu.be") {
    id = parts[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v") ?? undefined;
    else if (["shorts", "embed", "live", "v", "e"].includes(parts[0])) {
      id = parts[1];
      isShort = parts[0] === "shorts";
    }
  } else {
    return null;
  }
  return id && ID.test(id) ? { id, isShort } : null;
}

/** The link stored for a product: one clean form per video. */
export function normalisedYouTubeUrl(video: YouTubeVideo): string {
  return video.isShort ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;
}

/** The video's thumbnail (480 × 360, always available). */
export const youTubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Player address: muted, looping autoplay that also works inline on phones; the JS API is used to turn the sound on. */
export function youTubeEmbedUrl(id: string, origin?: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id, // needed for loop
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    ...(origin ? { origin } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}
