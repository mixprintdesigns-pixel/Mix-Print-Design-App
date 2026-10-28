import { expect, test, type Page } from "@playwright/test";

const uniqueEmail = () => `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

async function openBusinessCards(page: Page) {
  await page.goto("/products?category=business-cards");
  await page.getByRole("link", { name: /Standard Business Cards/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Standard Business Cards" })).toBeVisible();
}

test("browse catalog, filter and search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Print that makes your brand/ })).toBeVisible();
  await page.getByRole("link", { name: "Browse products" }).click();

  await expect(page.getByRole("link", { name: /Die-cut Stickers/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Packaging" }).click();
  await expect(page.getByRole("link", { name: /Custom Mailer Boxes/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Die-cut Stickers/ })).toHaveCount(0);

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
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeDisabled();
});

test("guest cart: add, update, remove", async ({ page }) => {
  await openBusinessCards(page);
  await page.getByText("Front & back").click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status")).toContainText("Added to your cart");
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.goto("/cart");
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Printed sides: Front & back")).toBeVisible();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("PKR 400"); // 100 × (3.00 + 1.00)

  await page.getByLabel("Qty").fill("1000");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("PKR 3,000"); // 1000 × (2.00 + 1.00)

  // The browser blocks below-minimum quantities; the server re-checks (see integration tests).
  await page.getByLabel("Qty").fill("50");
  await page.getByRole("button", { name: "Update" }).click();
  expect(await page.getByLabel("Qty").evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
  await expect(page.getByTestId("cart-subtotal")).toHaveText("PKR 3,000");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});

test("register keeps the guest cart, then sign out and sign back in", async ({ page }) => {
  const email = uniqueEmail();
  const password = "MixPrint2026!";

  await openBusinessCards(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.goto("/register?next=/cart");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Hamza Ali");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Mobile number/).fill("0321 7654321");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
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
