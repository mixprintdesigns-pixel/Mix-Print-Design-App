import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Admin → Rates and the size calculator: the owner sets a rate in Admin, the service page shows it with the
// calculator, each side is charged to the next full foot, and Order now saves the order before WhatsApp.

const BACKLIT = "/services/board-maker/backlit-sign-board";
const DIGITAL = "/services/digital-printing";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function stubWhatsApp(context: BrowserContext) {
  await context.route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "WhatsApp" }));
}

/** Opens the rate page for a service page in Admin, adding it the first time. */
async function openRatePage(page: Page, serviceName: string, optionLabel = serviceName) {
  await page.goto("/admin/rates");
  await expect(page.getByRole("button", { name: "Add rate page" })).toBeVisible(); // the list has streamed in
  const row = page.getByTestId("rate-page-row").filter({ has: page.getByRole("link", { name: serviceName, exact: true }) });
  if ((await row.count()) > 0) {
    await row.getByRole("link", { name: "Edit" }).click();
  } else {
    await page.getByLabel("Existing service page").selectOption({ label: optionLabel });
    await page.getByRole("button", { name: "Add rate page" }).click();
  }
  await expect(page).toHaveURL(/\/admin\/rates\/[^/?]+/);
}

/** Adds the item the first time, then opens its editor. */
async function openItem(page: Page, name: string, extra: { subtitle?: string; section?: string; priceBy?: string } = {}) {
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  const editor = page.getByTestId("rate-item-editor").filter({ hasText: name });
  if ((await editor.count()) === 0) {
    const add = page.locator("form", { has: page.getByRole("button", { name: "Add item" }) });
    await add.getByLabel("Name (H2 title)").fill(name);
    if (extra.subtitle) await add.getByLabel("Sub-title (optional)").fill(extra.subtitle);
    if (extra.section) await add.getByLabel("Section (optional)").fill(extra.section);
    if (extra.priceBy) await add.getByLabel("Price by").selectOption(extra.priceBy);
    await add.getByRole("button", { name: "Add item" }).click();
    await expect(editor).toHaveCount(1);
  }
  await editor.locator("summary").click();
  return editor;
}

/** Backlit: one item at Rs 45 per sq ft. */
async function setUpBacklitItem(page: Page) {
  await openRatePage(page, "Backlit Sign Board", "— Backlit Sign Board");
  const board = await openItem(page, "E2E Premium Backlit Board", { subtitle: "Premium" });
  await board.getByLabel(/^Description/).fill("Premium translucent media.\n\n- Waterproof\n- UV resistant\n- 5 years outdoor life");
  await board.getByLabel("Rate per sq ft (Rs)").fill("45");
  await board.getByLabel("Show on the website").check();
  await board.getByRole("button", { name: "Save item" }).click();
  await expect(board.getByRole("status")).toHaveText("Item saved.");
}

test("owner sets rates in Admin; the page shows them with the calculator; Order now saves the order", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "Admin part runs on desktop; the phone test below checks the page");
  await stubWhatsApp(context);
  await signInAsAdmin(page);

  // Backlit: one rate per sq ft
  await setUpBacklitItem(page);

  // Digital Printing: a flex with GSM rates
  await openRatePage(page, "Digital Printing");
  const flex = await openItem(page, "E2E Star Flex", { section: "Flex", priceBy: "GSM" });
  for (const [gsm, rate] of [["240 GSM", "35"], ["300 GSM", "42"]]) {
    await flex.getByLabel(`Rate per sq ft for ${gsm}`).fill(rate);
    await flex.getByRole("checkbox", { name: gsm }).check();
  }
  await flex.getByRole("button", { name: "Save item" }).click();
  await expect(flex.getByRole("status")).toHaveText("Item saved.");

  // The Backlit page: H1, item H2, sub-title, description, rate and the calculator
  await page.goto(BACKLIT);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Backlit Sign Board Price per Sq Ft in Lahore");
  const item = page.getByTestId("rate-item").filter({ has: page.getByRole("heading", { level: 2, name: "E2E Premium Backlit Board" }) });
  await expect(item.getByText("Premium", { exact: true })).toBeVisible();
  await expect(item.getByRole("listitem").filter({ hasText: "UV resistant" })).toBeVisible();
  await expect(item.getByTestId("rate-per-sqft")).toContainText("Rs 45 per sq ft");
  await expect(item.getByText("Each side is charged to the next full foot.")).toBeVisible();

  // 10 ft 3 in × 5 ft → 11 × 5 = 55 sq ft × Rs 45 = Rs 2,475 + Rs 1,000 design = Rs 3,475
  await item.getByLabel("Width (ft)").fill("10");
  await item.getByLabel("Width (in)").fill("3");
  await item.getByLabel("Height (ft)").fill("5");
  await expect(item.getByTestId("rate-size")).toHaveText("10 ft 3 in × 5 ft");
  await expect(item.getByTestId("rate-area")).toHaveText("11 ft × 5 ft = 55 sq ft");
  await expect(item.getByTestId("rate-printing")).toHaveText("Rs 2,475");
  await expect(item.getByTestId("rate-design")).toHaveText("Rs 1,000");
  await expect(item.getByTestId("rate-total")).toHaveText("Rs 3,475");

  // Other units: 100 cm × 50 cm → 4 ft × 2 ft = 8 sq ft
  await item.getByLabel("Unit").selectOption("cm");
  await item.getByLabel("Width (cm)").fill("100");
  await item.getByLabel("Height (cm)").fill("50");
  await expect(item.getByTestId("rate-size")).toHaveText("100 cm × 50 cm");
  await expect(item.getByTestId("rate-area")).toHaveText("4 ft × 2 ft = 8 sq ft");
  await item.getByLabel("Unit").selectOption("ft-in");
  await item.getByLabel("Width (ft)").fill("10");
  await item.getByLabel("Width (in)").fill("3");
  await item.getByLabel("Height (ft)").fill("5");

  // Order now: saved first, then WhatsApp with all the details
  await item.getByTestId("rate-order-now").click();
  await item.getByLabel("Your name").fill("Bilal Ahmed");
  await item.getByLabel("Mobile number").fill("0300 7654321");
  await item.getByLabel("City and address").fill("Johar Town, Lahore");
  const [whatsapp] = await Promise.all([page.context().waitForEvent("page"), item.getByRole("button", { name: "Confirm & continue on WhatsApp" }).click()]);
  await expect(page).toHaveURL(/\/order\/confirmed\?n=MP-/);
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
  const message = decodeURIComponent(whatsapp.url());
  for (const text of ["*E2E Premium Backlit Board*", "Material: E2E Premium Backlit Board (Premium)", "Size: 10 ft 3 in × 5 ft", "Billable area: 11 ft × 5 ft = 55 sq ft", "Design charges: PKR 1,000", "Total: PKR 3,475"]) {
    expect(message).toContain(text);
  }

  // Digital Printing: choosing a GSM uses its rate
  await page.goto(DIGITAL);
  const star = page.getByTestId("rate-item").filter({ has: page.getByRole("heading", { level: 2, name: "E2E Star Flex" }) });
  await expect(page.getByText("Flex", { exact: true }).first()).toBeVisible();
  await expect(star.getByTestId("rate-per-sqft")).toContainText("Rs 35");
  await star.getByText("300 GSM", { exact: true }).click();
  await expect(star.getByTestId("rate-per-sqft")).toContainText("Rs 42");
  await star.getByLabel("Width (ft)").fill("4");
  await star.getByLabel("Width (in)").fill("2");
  await star.getByLabel("Height (ft)").fill("3");
  await star.getByLabel("Height (in)").fill("1");
  await star.getByLabel("Quantity (pieces)").fill("2");
  // 5 × 4 × 2 = 40 sq ft × Rs 42 = Rs 1,680 + Rs 1,000
  await expect(star.getByTestId("rate-area")).toHaveText("5 ft × 4 ft × 2 = 40 sq ft");
  await expect(star.getByTestId("rate-total")).toHaveText("Rs 2,680");
  await expect(star.getByText("200 GSM", { exact: true })).toHaveCount(0); // rate 0: not offered

  // Product / Offer structured data with the per-sq-ft price
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(ld).toContain('"name":"E2E Star Flex"');
  expect(ld).toContain('"unitCode":"FTK"');
});

test("phone and app: one item per row, big buttons, nothing wider than the screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone layout");
  await signInAsAdmin(page);
  await setUpBacklitItem(page);
  await page.goto(`${BACKLIT}?app=1`);
  const item = page.getByTestId("rate-item").filter({ hasText: "E2E Premium Backlit Board" });
  await expect(item).toBeVisible();
  await item.getByLabel("Width (ft)").fill("3");
  await item.getByLabel("Width (in)").fill("1");
  await item.getByLabel("Height (ft)").fill("4");
  await item.getByLabel("Height (in)").fill("2");
  await expect(item.getByTestId("rate-area")).toHaveText("4 ft × 5 ft = 20 sq ft");
  expect((await item.getByTestId("rate-order-now").boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
