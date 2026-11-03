import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

// Optional YouTube video per product: set in Admin (Images area), shown in the product gallery as a light
// thumbnail until selected, then a muted looping player with "Tap for sound"; VideoObject structured data.
// YouTube itself is outside the test network, so its thumbnail and player addresses are answered locally.

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://mixprint:mixprint_dev@127.0.0.1:5432/mixprint_e2e";
const VIDEO_ID = "dQw4w9WgXcQ";

function createProduct(name: string, youtubeUrl = "", first = ""): { id: string; path: string } {
  const out = execFileSync("npx", ["tsx", "--conditions=react-server", "tests/e2e/support/create-video-test-product.ts", name, youtubeUrl, first], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").at(-1)!);
}

/** Answers YouTube locally and records every request to it. The fake player keeps the commands it receives. */
async function fakeYouTube(context: BrowserContext) {
  const requests: string[] = [];
  const thumbnail = await sharp({ create: { width: 480, height: 360, channels: 3, background: "#cc0000" } }).jpeg().toBuffer();
  await context.route(/^https:\/\/i\.ytimg\.com\//, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: thumbnail });
  });
  await context.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><body style="margin:0;background:#000;color:#fff">player<script>
        addEventListener("message", (e) => { document.body.dataset.commands = (document.body.dataset.commands || "") + JSON.parse(e.data).func + ","; });
      </script></body>`,
    });
  });
  return requests;
}

/** A horizontal swipe on the gallery, from x `from` to x `to`. */
async function swipe(target: Locator, from: number, to: number) {
  await target.evaluate(
    (el, [a, b]) => {
      const touch = (x: number) => new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: 200 });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(a)], changedTouches: [touch(a)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(b)], bubbles: true }));
    },
    [from, to],
  );
}

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("product video", () => {
  test("add a video in Admin (last by default), click to play with sound, show it first (muted autoplay), then remove it", async ({ page, context, isMobile }) => {
    test.skip(isMobile, "Admin is covered on desktop; the phone view is checked below");
    const product = createProduct(`Video Cards ${Date.now().toString(36)}`);
    const youtube = await fakeYouTube(context);
    await signInAsAdmin(page);

    // Admin: the field sits in the Images area; a wrong link shows a clear error
    await page.goto(`/admin/products/${product.id}`);
    const field = page.getByTestId("product-video");
    await expect(page.getByRole("region", { name: "Images" }).getByTestId("product-video")).toBeVisible();
    await field.getByLabel("YouTube video link (optional)").fill("https://vimeo.com/12345");
    await expect(field.getByRole("alert")).toContainText("not a YouTube video link");
    await expect(field.getByRole("button", { name: "Save video" })).toBeDisabled();

    // A share link with extra parameters: preview, default position "after all images (last)", save
    await field.getByLabel("YouTube video link (optional)").fill(`https://youtu.be/${VIDEO_ID}?si=AbCdEf&t=12`);
    await expect(field.getByTestId("video-preview")).toHaveAttribute("src", `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`);
    await expect(field.getByLabel("After all images (last)")).toBeChecked();
    await expect(field.getByLabel("After the first image")).not.toBeChecked();
    await expect(field.getByLabel("Show video first (main item)")).not.toBeChecked();
    await field.getByRole("button", { name: "Save video" }).click();
    await expect(field.getByRole("status")).toContainText("Video saved");
    await page.reload();
    await expect(page.getByTestId("product-video").getByLabel("YouTube video link (optional)")).toHaveValue(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    await expect(page.getByTestId("admin-image")).toHaveCount(2); // images untouched

    // Product page: the video is the last gallery item; nothing from YouTube's player loads until it is chosen
    youtube.length = 0;
    await page.goto(product.path);
    const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
    await expect(thumbs).toHaveCount(3);
    await expect(thumbs.nth(2)).toHaveAttribute("data-testid", "gallery-video-thumb");
    await expect(thumbs.nth(0)).toHaveAttribute("aria-pressed", "true"); // the first image stays the main item
    await expect(page.getByTestId("gallery-video-player")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(youtube.filter((u) => u.includes("youtube-nocookie.com"))).toEqual([]);

    // Structured data: VideoObject added, Product data unchanged
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    expect(jsonLd.find((d) => d["@type"] === "Product")).toMatchObject({ name: expect.stringContaining("Video Cards") });
    expect(jsonLd.find((d) => d["@type"] === "VideoObject")).toMatchObject({
      embedUrl: `https://www.youtube.com/embed/${VIDEO_ID}`,
      thumbnailUrl: [`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`],
      uploadDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });

    // Click the video: it starts at once, with sound and controls; no second click, no "Tap for sound"
    const main = page.getByTestId("gallery-main");
    const boxBefore = await main.boundingBox();
    await thumbs.nth(2).click();
    const player = page.getByTestId("gallery-video-player");
    await expect(player).toHaveAttribute("src", new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${VIDEO_ID}\\?autoplay=1&mute=0&controls=1&playsinline=1`));
    expect(await player.getAttribute("src")).not.toContain("loop=1");
    await expect(page.getByTestId("video-sound")).toHaveCount(0);
    expect(await main.boundingBox()).toEqual(boxBefore); // no layout jump
    const playerBox = (await player.boundingBox())!;
    expect(playerBox.width / playerBox.height).toBeCloseTo(16 / 9, 1);
    // The player is also told to unmute and play, in case it ignored the autoplay setting
    await expect(page.frameLocator('[data-testid="gallery-video-player"]').locator("body")).toHaveAttribute("data-commands", /^unMute,setVolume,playVideo,/);

    // After the first image: the video is the 2nd item
    await page.goto(`/admin/products/${product.id}`);
    await page.getByTestId("product-video").getByLabel("After the first image").check();
    await page.getByTestId("product-video").getByRole("button", { name: "Save video" }).click();
    await expect(page.getByTestId("product-video").getByRole("status")).toContainText("Video saved");
    await page.goto(product.path);
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button").nth(1)).toHaveAttribute("data-testid", "gallery-video-thumb");

    // Show video first: the main item, playing on its own, muted and looping, with "Tap for sound"
    await page.goto(`/admin/products/${product.id}`);
    await page.getByTestId("product-video").getByLabel("Show video first (main item)").check();
    await page.getByTestId("product-video").getByRole("button", { name: "Save video" }).click();
    await expect(page.getByTestId("product-video").getByRole("status")).toContainText("Video saved");
    await page.goto(product.path);
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button").first()).toHaveAttribute("data-testid", "gallery-video-thumb");
    const autoPlayer = page.getByTestId("gallery-video-player");
    await expect(autoPlayer).toHaveAttribute("src", /autoplay=1&mute=1&loop=1/);
    const commands = page.frameLocator('[data-testid="gallery-video-player"]').locator("body");
    await expect(commands).toHaveAttribute("data-commands", /^mute,playVideo,/); // made sure it plays, muted
    await page.getByTestId("video-sound").click();
    await expect(page.getByTestId("video-sound")).toHaveCount(0);
    await expect(commands).toHaveAttribute("data-commands", /unMute,setVolume,playVideo,/);

    // Remove: the gallery is images only again, as before
    await page.goto(`/admin/products/${product.id}`);
    await page.getByTestId("product-video").getByRole("button", { name: "Remove video" }).click();
    await expect(page.getByTestId("product-video").getByRole("status")).toContainText("Video removed");
    await page.goto(product.path);
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button")).toHaveCount(2);
    await expect(page.getByTestId("gallery-video-thumb")).toHaveCount(0);
    expect((await page.locator('script[type="application/ld+json"]').allTextContents()).some((t) => t.includes("VideoObject"))).toBe(false);
  });

  test("on a phone: tapping or swiping to the last item plays the video with sound; Shorts are upright", async ({ page, context, isMobile }) => {
    test.skip(!isMobile, "Phone only");
    const product = createProduct(`Video Short ${Date.now().toString(36)}`, `https://youtube.com/shorts/${VIDEO_ID}`);
    await fakeYouTube(context);
    await page.goto(product.path);
    const main = page.getByTestId("gallery-main");
    await expect(main).toBeVisible();
    const box = (await main.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

    // The video is last (after both images); tapping it plays at once with sound, upright 9:16 in the same box
    const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
    await expect(thumbs.nth(2)).toHaveAttribute("data-testid", "gallery-video-thumb");
    await thumbs.nth(2).tap();
    const player = page.getByTestId("gallery-video-player");
    await expect(player).toHaveAttribute("src", /autoplay=1&mute=0&controls=1/);
    await expect(page.getByTestId("video-sound")).toHaveCount(0);
    const p = (await player.boundingBox())!;
    expect(p.width / p.height).toBeCloseTo(9 / 16, 1);
    expect(await main.boundingBox()).toEqual(box);

    // Swipe left from the video: back to the first image
    await swipe(main, 300, 100);
    await expect(player).toHaveCount(0);
    // Swipe right from the first image: round to the video, with sound
    await swipe(main, 100, 320);
    await expect(player).toHaveAttribute("src", /mute=0/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("on a phone: a video shown first autoplays muted with Tap for sound", async ({ page, context, isMobile }) => {
    test.skip(!isMobile, "Phone only");
    const product = createProduct(`Video First ${Date.now().toString(36)}`, `https://www.youtube.com/watch?v=${VIDEO_ID}`, "FIRST");
    await fakeYouTube(context);
    await page.goto(product.path);
    const player = page.getByTestId("gallery-video-player");
    await expect(player).toHaveAttribute("src", /autoplay=1&mute=1&loop=1/);
    const commands = page.frameLocator('[data-testid="gallery-video-player"]').locator("body");
    await expect(commands).toHaveAttribute("data-commands", /^mute,playVideo,/);
    await page.getByTestId("video-sound").tap();
    await expect(page.getByTestId("video-sound")).toHaveCount(0);
    await expect(commands).toHaveAttribute("data-commands", /unMute,setVolume,playVideo,/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
