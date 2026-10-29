import { expect, test, type Browser } from "@playwright/test";

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password").fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return page;
}

test.describe("home page", () => {
  test("shows hero, top products, services and reviews in order", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "Admin part runs on desktop");
    const run = Date.now().toString(36);

    // Add a published and a hidden review in admin
    const admin = await adminPage(browser);
    await admin.goto("/admin/reviews");
    const add = admin.locator("form").filter({ hasText: "Add a review" });
    await add.getByLabel("Customer name").fill(`Ayesha ${run}`);
    await add.getByLabel("City / company (optional)").fill("Lahore");
    await add.getByLabel("Rating").selectOption("5");
    await add.getByLabel("Review").fill("Excellent print quality and the backlit board was ready on time.");
    await add.getByRole("button", { name: "Add review" }).click();
    await expect(admin.getByText("Review added.")).toBeVisible();
    await add.getByLabel("Customer name").fill(`Hidden ${run}`);
    await add.getByLabel("Review").fill("This one should not be visible.");
    await add.getByLabel("Show on the home page").uncheck();
    await add.getByRole("button", { name: "Add review" }).click();
    await expect(admin.getByTestId("admin-review").filter({ hasText: `Hidden ${run}` })).toContainText("hidden");

    await page.goto("/");
    await expect(page.getByRole("img", { name: "Mix Print Design" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Now" })).toHaveAttribute("href", "/products");
    await expect(page.getByRole("link", { name: "Get a Quote" })).toHaveAttribute("href", /\/contact\?subject=Quote/);

    const headings = await page.locator("main h2").allTextContents();
    const order = ["Top products", "Our services", "What our customers say"].map((h) => headings.findIndex((x) => x.includes(h)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const top = page.getByRole("region", { name: "Top products" });
    await expect(top.getByRole("link", { name: /Standard Business Cards/ })).toBeVisible();

    const services = page.getByRole("region", { name: "Our services" });
    await expect(services.getByTestId("service-card")).toHaveCount(3);
    await expect(services.getByRole("link", { name: "Backlit" })).toHaveAttribute("href", "/services/board-maker#backlit");

    const reviews = page.getByRole("region", { name: "What our customers say" });
    await expect(reviews.getByText(`Ayesha ${run}`)).toBeVisible();
    await expect(reviews.getByRole("img", { name: "5 out of 5 stars" }).first()).toBeVisible();
    await expect(page.getByText(`Hidden ${run}`)).toHaveCount(0);
  });

  test("top products scroll sideways on phones", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile layout check");
    await page.goto("/");
    const row = page.getByRole("region", { name: "Top products" }).locator("div.snap-x");
    const { scrollWidth, clientWidth } = await row.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    // The page itself must not scroll sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
