import { expect, test } from "@playwright/test";

// On phones every Admin page fits the screen: the Admin menu scrolls sideways in its own row
// instead of making the whole page wider than the screen.

test("Admin pages fit a phone screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phones only");
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  for (const path of ["/admin", "/admin/products", "/admin/orders", "/admin/blog", "/admin/blog/new", "/admin/payments", "/admin/reports", "/admin/customers", "/admin/designs"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(widths.page, `${path} is wider than the screen`).toBeLessThanOrEqual(widths.screen);
  }

  // The menu still reaches every section: it scrolls sideways within its row
  const menu = page.getByRole("navigation", { name: "Admin" }).getByRole("list");
  expect(await menu.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/admin\/reports$/);
});
