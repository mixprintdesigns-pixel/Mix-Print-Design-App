import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("product video", () => {
  test("add a video in Admin, see it in the gallery, play muted, tap for sound, then remove it", async ({ page, context, isMobile }) => {
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

    // A share link with extra parameters: preview, default position "after the first image", save
    await field.getByLabel("YouTube video link (optional)").fill(`https://youtu.be/${VIDEO_ID}?si=AbCdEf&t=12`);
    await expect(field.getByTestId("video-preview")).toHaveAttribute("src", `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`);
    await expect(field.getByLabel("After the first image")).toBeChecked();
    await field.getByRole("button", { name: "Save video" }).click();
    await expect(field.getByRole("status")).toContainText("Video saved");
    await page.reload();
    await expect(page.getByTestId("product-video").getByLabel("YouTube video link (optional)")).toHaveValue(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    await expect(page.getByTestId("admin-image")).toHaveCount(2); // images untouched

    // Product page: the video is the 2nd gallery item; nothing from YouTube's player loads until it is chosen
    youtube.length = 0;
    await page.goto(product.path);
    const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
    await expect(thumbs).toHaveCount(3);
    await expect(thumbs.nth(1)).toHaveAttribute("data-testid", "gallery-video-thumb");
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

    // Choose the video: it plays muted and looping, with the big "Tap for sound" button
    const main = page.getByTestId("gallery-main");
    const boxBefore = await main.boundingBox();
    await thumbs.nth(1).click();
    const player = page.getByTestId("gallery-video-player");
    await expect(player).toHaveAttribute("src", new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${VIDEO_ID}\\?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&playsinline=1`));
    expect(await main.boundingBox()).toEqual(boxBefore); // no layout jump
    const playerBox = (await player.boundingBox())!;
    expect(playerBox.width / playerBox.height).toBeCloseTo(16 / 9, 1);
    await page.getByTestId("video-sound").click();
    await expect(page.getByTestId("video-sound")).toHaveCount(0);
    await expect(page.frameLocator('[data-testid="gallery-video-player"]').locator("body")).toHaveAttribute("data-commands", /unMute,setVolume,playVideo,/);

    // Show video first: it becomes the main item and loads as soon as it is on screen
    await page.goto(`/admin/products/${product.id}`);
    await page.getByTestId("product-video").getByLabel("Show video first (main item)").check();
    await page.getByTestId("product-video").getByRole("button", { name: "Save video" }).click();
    await expect(page.getByTestId("product-video").getByRole("status")).toContainText("Video saved");
    await page.goto(product.path);
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button").first()).toHaveAttribute("data-testid", "gallery-video-thumb");
    await expect(page.getByTestId("gallery-video-player")).toHaveAttribute("src", /autoplay=1&mute=1/);
    await expect(page.getByTestId("video-sound")).toBeVisible();

    // Remove: the gallery is images only again, as before
    await page.goto(`/admin/products/${product.id}`);
    await page.getByTestId("product-video").getByRole("button", { name: "Remove video" }).click();
    await expect(page.getByTestId("product-video").getByRole("status")).toContainText("Video removed");
    await page.goto(product.path);
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button")).toHaveCount(2);
    await expect(page.getByTestId("gallery-video-thumb")).toHaveCount(0);
    expect((await page.locator('script[type="application/ld+json"]').allTextContents()).some((t) => t.includes("VideoObject"))).toBe(false);
  });

  test("on a phone: swipe from the image to the video; Shorts are shown upright; nothing overflows", async ({ page, context, isMobile }) => {
    test.skip(!isMobile, "Phone only");
    const product = createProduct(`Video Short ${Date.now().toString(36)}`, `https://youtube.com/shorts/${VIDEO_ID}`);
    await fakeYouTube(context);
    await page.goto(product.path);
    const main = page.getByTestId("gallery-main");
    await expect(main).toBeVisible();
    const box = (await main.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

    // Swipe left on the main image: the video (2nd item) loads, upright 9:16 inside the same box
    await main.evaluate((el) => {
      const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(300)], changedTouches: [touch(300)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(120)], bubbles: true }));
    });
    const player = page.getByTestId("gallery-video-player");
    await expect(player).toBeVisible();
    const p = (await player.boundingBox())!;
    expect(p.width / p.height).toBeCloseTo(9 / 16, 1);
    expect(await main.boundingBox()).toEqual(box);
    await expect(page.getByTestId("video-sound")).toBeVisible();

    // Swipe right: back to the first image
    await main.evaluate((el) => {
      const touch = (x: number) => new Touch({ identifier: 2, target: el, clientX: x, clientY: 200 });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(100)], changedTouches: [touch(100)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(320)], bubbles: true }));
    });
    await expect(player).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
