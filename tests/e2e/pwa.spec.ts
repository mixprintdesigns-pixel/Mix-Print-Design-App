import { expect, test } from "@playwright/test";

// The installable app (PWA, and the base of the Android app): manifest, service worker, offline page,
// install banner, Digital Asset Links, and the Privacy Policy and Terms pages.

test("manifest and icons", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Mix Print Design",
    short_name: "Mix Print",
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#00AFEF",
    background_color: "#00AFEF",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toBe("image/png");
  expect(await (await request.get("/.well-known/assetlinks.json")).json()).toEqual([]);
});

test("Chrome finds the site installable, and the service worker caches only static files", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "Checked once, on desktop Chrome");
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#00AFEF");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // now controlled by the service worker
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);

  // Visit a few pages, then look inside the cache: static files and the offline page only
  await page.goto("/products");
  await page.goto("/about");
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached).toContain("/offline");
  expect(cached.some((u) => u.startsWith("/_next/static/"))).toBe(true);
  for (const u of cached) expect(u).toMatch(/^(\/offline|\/_next\/static\/|\/brand\/|\/icon-(192|512)\.png)/);

  // Offline: pages show the offline page; Admin, login and orders are never served from the app
  await context.setOffline(true);
  await page.goto("/products");
  await expect(page.getByRole("heading", { level: 1, name: "You are offline" })).toBeVisible();
  await expect(page.getByText("Please check your internet")).toBeVisible();
  for (const path of ["/admin", "/login", "/order/confirmed", "/affiliate/dashboard"]) {
    await expect(page.goto(path)).rejects.toThrow(/ERR_INTERNET_DISCONNECTED/);
  }
  await context.setOffline(false);
  await page.goto("/products");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("You are offline");
});

test("phones get a small Install app banner, once per visitor", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phones only");
  await page.addInitScript(() => {
    // Stand-in for Chrome's install offer
    window.addEventListener("load", () => {
      setTimeout(() => {
        const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: async () => void ((window as unknown as { installPrompted: boolean }).installPrompted = true),
          userChoice: Promise.resolve({ outcome: "accepted" }),
        });
        window.dispatchEvent(event);
      }, 300);
    });
  });
  await page.goto("/");
  const banner = page.getByTestId("install-app-banner");
  await expect(banner).toBeVisible();
  // It sits above the header in the page, covering nothing
  const header = (await page.locator("header").first().boundingBox())!;
  const box = (await banner.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(header.y + 1);
  await banner.getByRole("button", { name: "Install app" }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { installPrompted?: boolean }).installPrompted)).toBe(true);

  // Not shown again
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("install-app-banner")).toHaveCount(0);
});

test("Privacy Policy and Terms pages, linked in the footer", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  for (const text of ["Neon database", "Resend", "never sell", "mixprintdesigns@gmail.com", "+92 303 488 9255", "Lahore, Pakistan", "payout details"]) {
    await expect(page.getByRole("main")).toContainText(text);
  }
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Terms & Conditions" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms & Conditions");
  for (const text of ["50% advance", "Delivery", "Affiliate program", "paid in full"]) await expect(page.getByRole("main")).toContainText(text);
});
