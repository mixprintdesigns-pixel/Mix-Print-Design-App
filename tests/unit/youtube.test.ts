import { describe, expect, it } from "vitest";
import { normalisedYouTubeUrl, parseYouTubeUrl, toVideoPosition, youTubeEmbedUrl, youTubeThumbnail } from "@/lib/youtube";

const ID = "dQw4w9WgXcQ";

describe("YouTube links", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123&t=10`,
    `https://www.youtube.com/embed/${ID}?start=5`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=shared`,
    `https://music.youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
  ])("reads %s", (link) => {
    expect(parseYouTubeUrl(link)).toEqual({ id: ID, isShort: false });
  });

  it("recognises Shorts (shown upright, 9:16)", () => {
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${ID}?si=xyz`)).toEqual({ id: ID, isShort: true });
    expect(normalisedYouTubeUrl({ id: ID, isShort: true })).toBe(`https://www.youtube.com/shorts/${ID}`);
  });

  it.each([
    "",
    "not a link",
    "https://vimeo.com/123456",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC1234567890",
    "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
  ])("rejects %s", (link) => {
    expect(parseYouTubeUrl(link)).toBeNull();
  });

  it("builds the stored link, thumbnail and privacy-friendly muted, looping player address", () => {
    expect(normalisedYouTubeUrl({ id: ID, isShort: false })).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(youTubeThumbnail(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    const embed = new URL(youTubeEmbedUrl(ID, "https://www.mixprintdesign.com"));
    expect(embed.hostname).toBe("www.youtube-nocookie.com");
    expect(Object.fromEntries(embed.searchParams)).toMatchObject({ autoplay: "1", mute: "1", loop: "1", playlist: ID, controls: "1", playsinline: "1", enablejsapi: "1" });
    // Started by the visitor's click: with sound and controls, not looping
    const clicked = Object.fromEntries(new URL(youTubeEmbedUrl(ID, undefined, { muted: false })).searchParams);
    expect(clicked).toMatchObject({ autoplay: "1", mute: "0", controls: "1", playsinline: "1" });
    expect(clicked.loop).toBeUndefined();
  });

  it("reads the video position, defaulting to after all images", () => {
    expect(toVideoPosition("FIRST")).toBe("FIRST");
    expect(toVideoPosition("AFTER_FIRST")).toBe("AFTER_FIRST");
    expect(toVideoPosition("LAST")).toBe("LAST");
    expect(toVideoPosition(undefined)).toBe("LAST");
    expect(toVideoPosition("nonsense")).toBe("LAST");
  });
});
