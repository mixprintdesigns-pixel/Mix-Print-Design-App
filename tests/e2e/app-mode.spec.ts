import { expect, test, type Page } from "@playwright/test";

// App mode: the site opened as the installed app (display-mode standalone / fullscreen). Here it is switched on
// with ?app=1, the same preview anyone can use in a browser. The normal website must stay as it is.

test.skip(({ isMobile }) => !isMobile, "The app runs on phones");

const PRODUCT = "/products/offset-printing/business-cards/standard-business-cards";

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("normal phone browser: website header and menu, no app bars", async ({ page }) => {
  await page.goto("/?app=0");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "App" })).toBeHidden();
  await expect(page.getByTestId("app-top-whatsapp")).toBeHidden();
  await expect(page.getByTestId("whatsapp-float")).toBeVisible();
  // The logo shows in the header, the hero and the footer, as before
  await expect(page.getByRole("img", { name: "Mix Print Design logo" }).filter({ visible: true })).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.classList.contains("app-mode"))).toBe(false);
});

test("app: one logo, slim top bar, bottom tabs, bigger text, nothing wider than the screen", async ({ page }) => {
  await page.goto("/?app=1");
  expect(await page.evaluate(() => document.documentElement.classList.contains("app-mode"))).toBe(true);
  await expect(page.getByRole("img", { name: "Mix Print Design logo" }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Sign in" }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByTestId("app-top-whatsapp")).toBeVisible();
  await expect(page.getByTestId("whatsapp-float")).toBeHidden();

  const tabs = page.getByRole("navigation", { name: "App" });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("listitem")).toHaveText(["Home", "Services", "Products", "Earn", "More"]);
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  const bar = (await tabs.boundingBox())!;
  expect(bar.y + bar.height).toBeCloseTo(page.viewportSize()!.height, 0);

  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(16.5);
  for (const button of await page.locator(".btn-primary, .btn-secondary").filter({ visible: true }).all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
  }
  await noSideScroll(page);

  // The app mode stays on while moving around
  await tabs.getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(tabs.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
  // One full-width card per row, with a clear button
  const cards = page.getByTestId("product-card").filter({ visible: true });
  const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
  expect(Math.round(a.x)).toBe(Math.round(b.x));
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  expect(a.width).toBeGreaterThan(page.viewportSize()!.width - 60);
  await expect(cards.first().getByText("View / Order")).toBeVisible();
  // Inputs never make the phone zoom in
  expect(await page.getByRole("searchbox").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await noSideScroll(page);
});

test("app: More lists every other page and account links", async ({ page }) => {
  await page.goto("/?app=1");
  await page.getByRole("navigation", { name: "App" }).getByRole("button", { name: "More" }).click();
  const more = page.getByRole("dialog", { name: "More" });
  await expect(more).toBeVisible();
  for (const label of ["Blog", "About Us", "Contact Us", "Track your order", "Privacy Policy", "Terms & Conditions", "Sign in", "Affiliate dashboard", "Chat on WhatsApp", "Facebook"]) {
    await expect(more.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  await expect(more.getByRole("link", { name: "Admin" })).toHaveCount(0); // admins only
  await more.getByRole("link", { name: /^Blog/ }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(more).toBeHidden();
  await expect(page.getByRole("navigation", { name: "App" }).getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "page");

  // Signed in as admin: My account, Admin and Sign out
  await page.goto("/login?app=1");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("navigation", { name: "App" }).getByRole("button", { name: "More" }).click();
  await expect(more.getByRole("link", { name: /My account/ })).toBeVisible();
  await expect(more.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(more.getByRole("button", { name: "Sign out" })).toBeVisible();
  await more.getByRole("button", { name: "Close" }).click();
  await expect(more).toBeHidden();
});

test("app: product page with full-width gallery, swipe, big options and a sticky Order now bar", async ({ page }) => {
  await page.goto(`${PRODUCT}?app=1`);
  const gallery = page.locator("main .card.aspect-\\[4\\/3\\]").first();
  const box = (await gallery.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);

  // Swipe to the next image
  const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
  await expect(thumbs.nth(0)).toHaveAttribute("aria-pressed", "true");
  await gallery.evaluate((el) => {
    const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 });
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(300)], changedTouches: [touch(300)], bubbles: true }));
    el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(100)], bubbles: true }));
  });
  await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");

  // Large option buttons
  const option = page.getByText("Front & back");
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);

  // The total and Order now stay in view at the bottom, above the tab bar
  const buyBar = page.locator("[data-app-buy-bar]");
  const tabs = (await page.getByRole("navigation", { name: "App" }).boundingBox())!;
  const bar = (await buyBar.boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(tabs.y + 1);
  await expect(buyBar.getByTestId("live-total")).toBeInViewport();
  await option.click();
  await page.getByLabel("Quantity").fill("500");
  await expect(buyBar.getByTestId("live-total")).toHaveText("PKR 1,750"); // 500 × (tier 2.50 + front & back 1.00)
  await buyBar.getByTestId("order-now").click();
  await expect(page.getByRole("form", { name: "Your details" })).toBeInViewport();
  await noSideScroll(page);
});

test("normal phone browser: the product page and lists are unchanged", async ({ page }) => {
  await page.goto(`${PRODUCT}?app=0`);
  const buyBar = page.locator("[data-app-buy-bar]");
  expect(await buyBar.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  await expect(page.getByRole("navigation", { name: "App" })).toBeHidden();
  await page.goto("/products");
  await expect(page.getByTestId("product-card").first().getByText("View / Order")).toBeHidden();
});
