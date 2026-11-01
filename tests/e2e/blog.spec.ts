import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// Blog: the admin writes and publishes an article (cover, image in the text, FAQ, linked product, SEO);
// visitors see it on /blog with its SEO tags, structured data, sitemap and RSS entries; it can be deleted.

test.skip(({ isMobile }) => isMobile, "Admin workflow is covered on desktop; the public pages are checked on mobile below");

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

/** Hidden or missing articles show the "Page not found" page, marked noindex for search engines. */
async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
}

/** Pastes into the article editor as the browser would (plain text and/or HTML on the clipboard). */
async function pasteInto(page: Page, data: { text?: string; html?: string }) {
  await page.getByTestId("article-editor").click();
  await page.getByTestId("article-editor").evaluate((el, d) => {
    const clipboard = new DataTransfer();
    if (d.text) clipboard.setData("text/plain", d.text);
    if (d.html) clipboard.setData("text/html", d.html);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
  }, data);
}

const photo = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#00AFEF" } }).jpeg().toBuffer();

test("write, publish, view, share and delete a blog article", async ({ page, request }) => {
  const run = Date.now().toString(36);
  const title = `Flex Banner Printing Guide ${run}`;
  const slug = `flex-banner-printing-guide-${run}`;
  await signInAsAdmin(page);

  // The sample Draft is in Admin and not on the site
  await page.goto("/admin/blog");
  await expect(page.getByTestId("admin-blog-row").filter({ hasText: "Business Card Printing in Lahore: A Simple Guide" })).toContainText("Draft");
  await expectNotFound(page, "/blog/business-card-printing-guide");
  await page.goto("/admin/blog");

  // New article
  await page.getByRole("link", { name: "New article" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await expect(page.getByLabel("URL slug")).toHaveValue(slug);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Flex Printing" });
  await page.getByLabel("Tags (comma separated)").fill("flex, banners");
  await page.getByLabel("Short excerpt").fill("How to choose flex banner material, size and finishing in Lahore.");

  await page.getByLabel("Cover image file").setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer: await photo(2000, 1500) });
  await expect(page.getByTestId("cover-preview")).toBeVisible();
  await page.getByLabel("Cover alt text (required)").fill("Flex banner on a shop front");

  // Paste an article copied as plain text with Markdown (e.g. from ChatGPT): it appears formatted.
  const editor = page.getByTestId("article-editor");
  await pasteInto(page, {
    text: [
      `Flex banner printing is the fastest way to advertise. See our [flex products](/products/digital-printing).`,
      "## Materials",
      "Choose **star flex** or *Chinese flex*.",
      "## Sizes",
      "| Size | Use |\n| --- | --- |\n| 3 × 6 ft | Shops |",
      "### Finishing",
      "- Eyelets\n- Pipes",
      "> Tip: check the proof.",
    ].join("\n\n"),
  });
  await expect(editor.getByRole("heading", { level: 2, name: "Materials" })).toBeVisible();
  await expect(editor.locator("strong", { hasText: "star flex" })).toBeVisible();
  await expect(editor.getByRole("cell", { name: "3 × 6 ft" })).toBeVisible();
  await expect(editor).not.toContainText("##");
  await expect(editor).not.toContainText("**");

  // An image inside the text needs alt text first; it goes where the cursor is (here: the end)
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.getByRole("button", { name: "Insert image" }).click();
  await page.getByLabel("Image to insert").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await photo(2400, 1600) });
  await expect(page.getByTestId("insert-image").getByRole("alert")).toContainText("Write the alt text first");
  await page.getByTestId("insert-image").getByLabel("Alt text (required)").fill("Printed flex banner with eyelets");
  await page.getByLabel("Image to insert").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await photo(2400, 1600) });
  await expect(editor.getByRole("img", { name: "Printed flex banner with eyelets" })).toHaveAttribute("src", /\/media\/blog\/.+\.webp$/);

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("article-preview").getByRole("heading", { name: "Materials" })).toBeVisible();
  await expect(page.getByTestId("article-preview").getByRole("img", { name: "Printed flex banner with eyelets" })).toBeVisible();

  await page.getByRole("button", { name: "+ Add question" }).click();
  await page.getByLabel("Question 1").fill("How long does flex printing take?");
  await page.getByLabel("Answer 1").fill("Usually one working day.");
  await page.getByLabel("Find products").fill("Vinyl Flex");
  await page.getByRole("checkbox", { name: /Vinyl Flex Banner/ }).check();

  await page.getByLabel("Focus keyword").fill("flex banner printing");
  await expect(page.getByTestId("seo-checklist")).toContainText("Keyword in the first paragraph");
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Create article" }).click();
  await expect(page).toHaveURL(/\/admin\/blog\/[^/]+\?created=1$/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);

  // Public list: card, category filter, search
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const card = page.getByTestId("blog-card").filter({ hasText: title });
  await expect(card).toContainText("Flex Printing");
  await expect(card).toContainText("min read");
  await page.getByRole("navigation", { name: "Blog categories" }).getByRole("link", { name: /^Flex Printing/ }).click();
  await expect(page).toHaveURL(/category=flex-printing/);
  await expect(card).toBeVisible();
  await page.getByLabel("Search articles").fill(run);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("blog-card")).toHaveCount(1);
  await card.getByRole("link", { name: title }).click();

  // Article page
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator("h1").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId("toc")).toContainText("Materials");
  await expect(page.getByRole("table")).toContainText("3 × 6 ft");
  await expect(page.getByRole("img", { name: "Printed flex banner with eyelets" })).toBeVisible();
  await expect(page.getByTestId("blog-faq")).toContainText("How long does flex printing take?");
  await expect(page.getByTestId("blog-product")).toContainText("Vinyl Flex Banner");
  await expect(page.getByTestId("blog-product").getByRole("link", { name: "Order now" })).toHaveAttribute("href", /^\/products\/.+\/flex-banner$/);
  await expect(page.getByTestId("blog-cta").getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/923034889255\?text=/);
  await expect(page.getByTestId("share-whatsapp").first()).toHaveAttribute("href", new RegExp(`wa\\.me/\\?text=.*${slug}`));

  // SEO tags and structured data
  await expect(page).toHaveTitle(`${title} | Mix Print Design`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "How to choose flex banner material, size and finishing in Lahore.");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/blog/${slug}$`));
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /\/media\/blog\/.+\.webp$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).flat();
  const types = jsonLd.map((d: { "@type": string }) => d["@type"]);
  expect(types).toEqual(expect.arrayContaining(["BlogPosting", "FAQPage", "BreadcrumbList"]));
  expect(jsonLd.find((d: { "@type": string }) => d["@type"] === "BlogPosting")).toMatchObject({ headline: title, author: { name: "Mix Print Design" } });

  // Sitemap, RSS and menu
  expect(await (await request.get("/sitemap.xml")).text()).toContain(`/blog/${slug}`);
  const rss = await request.get("/blog/rss.xml");
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain(`<title>${title}</title>`);
  await expect(page.locator("header").getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");
  await expect(page.locator("footer").getByRole("link", { name: /Blog/ })).toHaveAttribute("href", "/blog");

  // Delete (with confirmation)
  await page.goto("/admin/blog");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("admin-blog-row").filter({ hasText: title }).getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(page.getByTestId("admin-blog-row").filter({ hasText: title })).toHaveCount(0);
  await expectNotFound(page, `/blog/${slug}`);
});

test("blog categories can be added in Admin", async ({ page }) => {
  const name = `Tips ${Date.now().toString(36)}`;
  await signInAsAdmin(page);
  await page.goto("/admin/blog/categories");
  await expect(page.getByTestId("blog-category-row").filter({ has: page.locator('input[value="Printing Tips"]') })).toBeVisible();
  await page.getByLabel("Name").first().fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Category added." })).toBeVisible();
  await page.goto("/blog");
  await expect(page.getByRole("navigation", { name: "Blog categories" })).toContainText(name);
});
