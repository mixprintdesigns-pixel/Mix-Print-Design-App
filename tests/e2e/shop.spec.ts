import { expect, test, type Page } from "@playwright/test";

const uniqueEmail = () => `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

async function openBusinessCards(page: Page) {
  await page.goto("/products/offset-printing/business-cards");
  await page.getByRole("link", { name: /Standard Business Cards/ }).click();
  await expect(page).toHaveURL(/\/products\/offset-printing\/business-cards\/standard-business-cards$/);
  await expect(page.getByRole("heading", { level: 1, name: "Standard Business Cards" })).toBeVisible();
}

test("browse catalog, filter and search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Print that makes your brand/ })).toBeVisible();
  await page.getByRole("link", { name: "Shop Now" }).click();

  await expect(page.getByRole("link", { name: /Die-cut Stickers/ })).toBeVisible();
  // The category tree expands: main service → category; a parent includes its sub-categories' products.
  const tree = page.getByRole("navigation", { name: "Categories" });
  for (const service of ["Board Maker", "Offset Printing", "Digital Printing", "Customized Printing"]) {
    await expect(tree.getByRole("link", { name: new RegExp(`^${service} \\(\\d+\\)$`) })).toBeVisible();
  }
  await tree.getByRole("link", { name: /^Offset Printing/ }).click();
  await expect(page).toHaveURL(/\/products\/offset-printing$/);
  await expect(page.getByRole("heading", { level: 1, name: "Offset Printing" })).toBeVisible();
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: /^Packaging & Boxes/ }).click();
  await expect(page).toHaveURL(/\/products\/offset-printing\/packaging-boxes$/);
  await expect(page.getByRole("link", { name: /Custom Mailer Boxes/ })).toBeVisible(); // lives in the Mailer Boxes sub-category
  await expect(page.getByRole("link", { name: /Die-cut Stickers/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Offset Printing");

  await page.goto("/products");
  await page.getByRole("searchbox", { name: "Search" }).fill("banner");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: /Vinyl Flex Banner/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Letterheads/ })).toHaveCount(0);
});

test("product gallery and live price", async ({ page }) => {
  await openBusinessCards(page);

  const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
  await expect(thumbs).toHaveCount(4);
  await thumbs.nth(2).click();
  await expect(thumbs.nth(2)).toHaveAttribute("aria-pressed", "true");

  const total = page.getByTestId("live-total");
  await expect(total).toHaveText("PKR 300"); // 100 × PKR 3.00
  await page.getByText("400gsm Gloss").click();
  await expect(total).toHaveText("PKR 350"); // 100 × PKR 3.50
  await page.getByLabel("Quantity").fill("500");
  await expect(total).toHaveText("PKR 1,500"); // tier 2.50 + 0.50 gloss = 3.00 × 500

  await page.getByLabel("Quantity").fill("150");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/steps of 100/);
  await expect(page.getByTestId("order-whatsapp")).toHaveCount(0); // no order link while the quantity is invalid
});

test("orders go to WhatsApp with the chosen options; the cart is switched off", async ({ page, request }) => {
  await openBusinessCards(page);
  await page.getByText("Front & back").click();
  await page.getByLabel("Quantity").fill("500");
  await page.getByLabel(/Notes for our team/).fill("Logo on both sides");
  const order = page.getByTestId("order-whatsapp");
  await expect(order).toHaveText("Order on WhatsApp");
  const href = decodeURIComponent((await order.getAttribute("href"))!);
  expect(href).toMatch(/^https:\/\/wa\.me\/923034889255\?text=/);
  for (const text of ["*Standard Business Cards*", "Printed sides: Front & back", "Quantity: 500", "Notes: Logo on both sides"]) expect(href).toContain(text);
  expect(href).toContain("/products/offset-printing/business-cards/standard-business-cards");

  await expect(page.locator("header").getByRole("link", { name: /Cart/ })).toHaveCount(0);
  const cart = await request.get("/cart", { maxRedirects: 0 });
  expect(cart.status()).toBe(307);
  expect(cart.headers()["location"]).toMatch(/\/products$/);
});

test("register, sign out and sign back in", async ({ page }) => {
  const email = uniqueEmail();
  const password = "MixPrint2026!";

  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Hamza Ali");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Mobile number/).fill("0321 7654321");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test("account page requires sign in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});

test("session cookie is httpOnly", async ({ page, context }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Cookie Check");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("MixPrint2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  const session = (await context.cookies()).find((c) => c.name === "mp_session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("mp_session");
});

test("old category links redirect permanently to the new clean URLs", async ({ page, request }) => {
  const res = await request.get("/products?category=business-cards", { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toMatch(/\/products\/offset-printing\/business-cards$/);
  expect((await request.get("/products?category=marketing", { maxRedirects: 0 })).headers()["location"]).toMatch(/\/products$/);

  // Business cards now list products (and include all sub-categories).
  await page.goto("/products?category=business-cards");
  await expect(page).toHaveURL(/\/products\/offset-printing\/business-cards$/);
  await expect(page.getByTestId("product-card")).not.toHaveCount(0);
});

test("SEO basics: canonical, structured data, sitemap and robots", async ({ page, request }) => {
  await page.goto("/products/offset-printing/business-cards/matte?sort=price-asc");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle("Matte Business Cards Printing in Lahore | Mix Print Design");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\/offset-printing\/business-cards\/matte$/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Matte Business Cards/);

  await page.goto("/products/offset-printing/business-cards/standard-business-cards");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  const types = ld.map((d) => d["@type"]);
  expect(types).toEqual(expect.arrayContaining(["Product", "BreadcrumbList", "LocalBusiness"]));
  expect(ld.find((d) => d["@type"] === "Product").offers).toMatchObject({ priceCurrency: "PKR", availability: "https://schema.org/InStock" });

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/services/board-maker/3d-sign-board</loc>");
  expect(sitemap).toContain("/products/offset-printing/business-cards/standard-business-cards</loc>");
  const robots = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/cart", "/checkout", "/account"]) expect(robots).toContain(`Disallow: ${path}`);
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

  // Unknown catalog URLs show the 404 page, marked noindex so search engines drop them.
  await page.goto("/products/no-such-category");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});
