import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// The visual article editor: existing articles open intact, formatting shows while typing, applying a format
// never moves the page, images can be inserted mid-article, linked and captioned, and everything saves.
//
// Desktop only for now: on phone-sized screens every Admin page is wider than the screen (the existing Admin
// side menu does not shrink), which blocks taps on all Admin pages, not just this one.
test.skip(({ isMobile }) => isMobile, "Admin pages overflow on phones (existing Admin layout); covered on desktop");

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function paste(page: Page, data: { text?: string; html?: string }) {
  await page.getByTestId("article-editor").evaluate((el, d) => {
    const clipboard = new DataTransfer();
    if (d.text) clipboard.setData("text/plain", d.text);
    if (d.html) clipboard.setData("text/html", d.html);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
  }, data);
}

/** Double-clicks a word to select it (the visitor's usual way), after bringing it into view. */
async function selectWord(page: Page, paragraphText: string) {
  const p = page.getByTestId("article-editor").locator("p", { hasText: paragraphText });
  await p.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120)); // not right under the sticky toolbar
  await p.dblclick({ position: { x: 12, y: 8 } });
  return p;
}

/** The page must not move by more than a couple of pixels. */
async function expectNoJump(page: Page, action: () => Promise<void>) {
  const before = await page.evaluate(() => window.scrollY);
  await action();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before), `page scrolled from ${before} to ${after}`).toBeLessThanOrEqual(2);
}

test("the sample Draft opens in the visual editor with all its formatting", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/blog");
  await page.getByTestId("admin-blog-row").filter({ hasText: "Business Card Printing in Lahore: A Simple Guide" }).getByRole("link", { name: "Edit" }).click();
  const editor = page.getByTestId("article-editor");
  await expect(editor.getByRole("heading", { level: 2, name: "Paper and finish" })).toBeVisible();
  await expect(editor.getByRole("heading", { level: 3, name: "Quantity and price" })).toBeVisible();
  await expect(editor.locator("strong", { hasText: "business card printing" })).toBeVisible();
  await expect(editor.locator("li")).toHaveCount(3);
  await expect(editor.getByRole("cell", { name: "Modern square cards" })).toBeVisible();
  await expect(editor.locator("blockquote")).toContainText("always check the proof");
  await expect(editor.getByRole("link", { name: "business cards" })).toHaveAttribute("href", "/products");
  await expect(editor).not.toContainText("##");
  await expect(editor).not.toContainText("**");
  await expect(page.getByText(/\d+ words · \d+ min read/)).toBeVisible();
});

test("long article: formatting and images in the middle never move the page, and everything saves", async ({ page }) => {
  const run = Date.now().toString(36);
  const title = `Long editor test ${run}`;
  await signInAsAdmin(page);
  await page.goto("/admin/blog/new");
  await page.getByLabel("Title", { exact: true }).fill(title);

  // A long article, pasted as Markdown text
  const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1} about sign boards in Lahore, with enough words to fill a line or two of text here.`);
  await page.getByTestId("article-editor").click({ position: { x: 24, y: 24 } });
  await paste(page, { text: ["## Introduction", ...paragraphs].join("\n\n") });
  await expect(page.getByTestId("article-editor").locator("p", { hasText: "Paragraph 40 " })).toBeVisible();
  await page.getByRole("button", { name: "Create article" }).click();
  await expect(page).toHaveURL(/\/admin\/blog\/[^/]+\?created=1$/);
  const editor = page.getByTestId("article-editor");
  await expect(editor.locator("p", { hasText: "Paragraph 40 " })).toBeVisible();

  // H2 on a paragraph in the middle: no jump, and the toolbar is still in reach (sticky)
  await selectWord(page, "Paragraph 20 ");
  await expectNoJump(page, () => page.getByRole("button", { name: "Heading (H2)" }).click());
  await expect(editor.getByRole("heading", { level: 2, name: /Paragraph 20 / })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeInViewport();

  // Bold, then a bullet list
  await selectWord(page, "Paragraph 22 ");
  await expectNoJump(page, () => page.getByRole("button", { name: "Bold (Ctrl+B)" }).click());
  await expect(editor.locator("p", { hasText: "Paragraph 22 " }).locator("strong")).toHaveCount(1);
  await selectWord(page, "Paragraph 24 ");
  await expectNoJump(page, () => page.getByRole("button", { name: "Bullet list" }).click());
  await expect(editor.locator("li", { hasText: "Paragraph 24 " })).toBeVisible();

  // Ctrl+K opens the link picker for the selected words; choose a page from the site
  await selectWord(page, "Paragraph 26 ");
  await page.keyboard.press("ControlOrMeta+k");
  const picker = page.getByTestId("link-picker");
  await expect(picker).toBeVisible();
  await picker.getByLabel("Search pages to link").fill("Contact Us");
  await picker.getByRole("button", { name: /Contact Us page/ }).click();
  await picker.getByRole("button", { name: "Apply link" }).click();
  await expect(editor.locator("p", { hasText: "Paragraph 26 " }).getByRole("link")).toHaveAttribute("href", "/contact");

  // An image in the middle (after paragraph 30), with alt text, caption and a link
  const p30 = await selectWord(page, "Paragraph 30 ");
  await p30.click();
  await page.keyboard.press("End");
  await expectNoJump(page, () => page.getByRole("button", { name: "Insert image" }).click());
  await page.getByTestId("insert-image").getByLabel("Alt text (required)").fill("3D sign board on a shop front");
  const jpg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#00AFEF" } }).jpeg().toBuffer();
  await expectNoJump(page, () => page.getByLabel("Image to insert").setInputFiles({ name: "board.jpg", mimeType: "image/jpeg", buffer: jpg }));
  const image = editor.getByRole("img", { name: "3D sign board on a shop front" });
  await expect(image).toBeVisible();
  const order = await editor.evaluate((el) => [...el.children].map((c) => c.textContent?.match(/Paragraph \d+ /)?.[0] ?? (c.querySelector("img") ? "IMAGE" : "")));
  expect(order.indexOf("IMAGE")).toBe(order.indexOf("Paragraph 30 ") + 1);

  await image.click();
  const settings = page.getByTestId("image-settings");
  await settings.getByLabel("Caption (optional)").fill("Our work in Johar Town");
  await settings.getByRole("button", { name: /Add a link to this image/ }).click();
  await picker.getByLabel("Search pages to link").fill("3D Sign Board");
  await picker.getByRole("button", { name: /Sign Board Maker › 3D Sign Board/ }).first().click();
  await picker.getByRole("button", { name: "Apply link" }).click();
  await expect(editor.locator("figure", { has: page.getByRole("img", { name: "3D sign board on a shop front" }) })).toContainText("🔗 /services/");

  // Save, reload: everything is still there
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved as a draft." })).toBeVisible();
  await page.reload();
  await expect(editor.getByRole("heading", { level: 2, name: /Paragraph 20 / })).toBeVisible();
  await expect(editor.locator("p", { hasText: "Paragraph 22 " }).locator("strong")).toHaveCount(1);
  await expect(editor.locator("li", { hasText: "Paragraph 24 " })).toBeVisible();
  await expect(editor.locator("figure", { hasText: "Our work in Johar Town" })).toBeVisible();

  // Preview shows the clickable image with its caption, as the public page will
  await page.getByRole("tab", { name: "Preview" }).click();
  const preview = page.getByTestId("article-preview");
  const linked = preview.getByRole("link", { name: "3D sign board on a shop front" });
  await expect(linked).toHaveAttribute("href", /^\/services\/.+3d-sign-board$/);
  await expect(linked).toHaveCSS("cursor", "pointer");
  await expect(preview.getByText("Our work in Johar Town")).toBeVisible();
  await expect(preview.locator("p", { hasText: "Paragraph 26 " }).getByRole("link")).toHaveAttribute("href", "/contact");
});

test("pasting from Google Docs keeps headings, bold and lists but drops fonts and colours", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/blog/new");
  await page.getByTestId("article-editor").click({ position: { x: 24, y: 24 } });
  await paste(page, {
    html: `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-abc"><h1 style="font-family:Arial;color:#ff0000">Big title</h1><p><span style="font-family:Comic Sans MS;color:#00ff00;font-size:20pt">Plain words and </span><span style="font-weight:700;color:blue">bold words</span></p><ul><li><span style="font-family:Times">first point</span></li></ul></b>`,
    text: "Big title\nPlain words and bold words\nfirst point",
  });
  const editor = page.getByTestId("article-editor");
  await expect(editor.getByRole("heading", { level: 2, name: "Big title" })).toBeVisible();
  await expect(editor.locator("strong")).toHaveText("bold words");
  await expect(editor.locator("li")).toHaveText("first point");
  await expect(editor.locator("[style]")).toHaveCount(0);
  await expect(editor.locator("p", { hasText: "Plain words" }).locator("strong")).toHaveCount(1); // only "bold words", not the whole text
});

test("unsaved text is kept on this device and can be restored after a reload", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/blog");
  await page.getByTestId("admin-blog-row").filter({ hasText: "Business Card Printing in Lahore: A Simple Guide" }).getByRole("link", { name: "Edit" }).click();
  const editor = page.getByTestId("article-editor");
  await editor.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Not saved yet sentence.");
  await expect(page.getByText(/Draft kept on this device/)).toBeVisible();
  await page.reload();
  await expect(editor).not.toContainText("Not saved yet sentence.");
  await page.getByRole("button", { name: "Restore it" }).click();
  await expect(editor).toContainText("Not saved yet sentence.");
  // Discarding leaves the saved article as it was
  await page.reload();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(editor).not.toContainText("Not saved yet sentence.");
});
