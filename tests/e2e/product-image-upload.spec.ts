import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

// Admin product image upload: several files at once (JPG, PNG, WebP), including a photo too big to send
// as is (it is shrunk in the browser first). Every image is stored as WebP within 1000 × 1000 px.

test.skip(({ isMobile }) => isMobile, "Admin workflow is covered on desktop");

test("uploads JPG, PNG and WebP images, including a large photo", async ({ page }) => {
  const solid = (format: "jpeg" | "webp") =>
    sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#00AFEF" } })[format]().toBuffer();
  // Random pixels compress badly, so this PNG is over 4.5 MB, more than Vercel accepts in one request.
  const big = await sharp(randomBytes(1500 * 1500 * 3), { raw: { width: 1500, height: 1500, channels: 3 } }).png().toBuffer();
  expect(big.length).toBeGreaterThan(4.5 * 1024 * 1024);

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/admin/products");
  const edit = page.locator('a[href^="/admin/products/"]:not([href$="/new"])').filter({ visible: true }).first();
  await page.goto((await edit.getAttribute("href"))!);
  const before = await page.getByTestId("admin-image").count();

  await page.getByTestId("image-upload").setInputFiles([
    { name: "photo.jpg", mimeType: "image/jpeg", buffer: await solid("jpeg") },
    { name: "photo.webp", mimeType: "image/webp", buffer: await solid("webp") },
    { name: "huge-photo.png", mimeType: "image/png", buffer: big },
  ]);
  await expect(page.getByText("3 images uploaded.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("admin-image")).toHaveCount(before + 3);

  // Saved as WebP, no larger than 1000 × 1000
  const src = await page.getByTestId("admin-image").last().locator("img").getAttribute("src");
  const url = decodeURIComponent(src!.match(/url=([^&]+)/)?.[1] ?? src!);
  expect(url).toMatch(/\.webp$/);
  const saved = await page.request.get(url);
  const meta = await sharp(await saved.body()).metadata();
  expect(meta.format).toBe("webp");
  expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1000);

  // A file that is not an image gets a message, and the page keeps working
  await page.getByTestId("image-upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert").filter({ hasText: "use a JPG, PNG or WebP image" })).toBeVisible();
  await expect(page.getByTestId("admin-image")).toHaveCount(before + 3);
});
