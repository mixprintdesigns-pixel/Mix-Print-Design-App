import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

// Rates & calculator, set in Admin → Categories & Services → All settings (one page, one Save), shown on every
// related page (Services, sub-categories, Products), with per-sq-ft prices on cards and the 3D Wallpaper gallery.
// Each test removes what it adds.

const DIGITAL = "/services/digital-printing";
const FLEX_PRINTING = `${DIGITAL}/flex-printing`;
const CHINA = `${FLEX_PRINTING}/china-flex`;
const WALLPAPER = `${DIGITAL}/3d-wallpaper`;

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function allSettings(page: Page, name: string) {
  await page.goto("/admin/categories");
  await page.getByRole("link", { name: `All settings of ${name}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function save(page: Page) {
  await page.getByTestId("save-all").click();
  await expect(page.getByRole("status").filter({ hasText: "All settings saved." })).toBeVisible();
}

const sectionEditor = (page: Page, title: string) => page.getByTestId("full-section").filter({ has: page.locator("p", { hasText: title }) });

/** Adds a Flex/Sticker section with rows of buttons, all in the editor (saved by the caller). */
async function addSection(page: Page, kind: "Flex" | "Sticker", title: string, rows: { name: string; buttons: [string, string, string?][] }[], showOn: string[] = []) {
  await page.getByRole("button", { name: `+ ${kind} section` }).click();
  const section = page.getByTestId("full-section").last();
  await section.getByLabel("Section title").fill(title);
  for (const row of rows) {
    await section.getByRole("button", { name: kind === "Flex" ? "+ Add a button row" : "+ Add a sticker type" }).click();
    const group = section.getByTestId("full-group").last();
    await group.getByRole("textbox").first().fill(row.name);
    for (const [i, [label, rate, rule]] of row.buttons.entries()) {
      await group.getByRole("button", { name: `+ Add a button to ${row.name}` }).click();
      await group.getByLabel(`${row.name} button ${i + 1} text`).fill(label);
      await group.getByLabel(`${row.name} button ${i + 1} rate`).fill(rate);
      if (rule) await group.getByLabel(`${row.name} button ${i + 1} pricing rule`).selectOption(rule);
    }
  }
  if (showOn.length) {
    await section.getByText(/Also show this section on/).click();
    for (const label of showOn) await section.getByLabel(label, { exact: true }).check();
  }
  return section;
}

async function deleteSection(page: Page, category: string, title: string) {
  await allSettings(page, category);
  await sectionEditor(page, title).getByLabel("Delete section").check();
  page.once("dialog", (d) => d.accept());
  await save(page);
  await expect(sectionEditor(page, title)).toHaveCount(0);
}

async function enterSize(calc: Locator, w: [string, string], h: [string, string]) {
  await calc.getByLabel("Width (ft)").fill(w[0]);
  await calc.getByLabel("Width (in)").fill(w[1]);
  await calc.getByLabel("Height (ft)").fill(h[0]);
  await calc.getByLabel("Height (in)").fill(h[1]);
}

test.describe.configure({ mode: "serial" });

test("Part 1: adding a button keeps every other rate (Flex and Stickers), one Save for the whole page", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin editing runs on desktop");
  const run = Date.now().toString(36);
  const flexTitle = `E2E Flex ${run} GSM & Rate per sq ft (Rs)`;
  const stickerTitle = `E2E Sticker ${run} Series & Rate per sq ft (Rs)`;
  await signInAsAdmin(page);
  await allSettings(page, "Digital Printing");
  await addSection(page, "Flex", flexTitle, [
    { name: "Flex", buttons: [["240 GSM", "45"], ["280 GSM", "55"]] },
    { name: "Most Famous Flex Names", buttons: [["China Flex 240 GSM", "45"], ["Reflective Flex 400 GSM", "90", "STICKER"]] },
  ], ["— Flex Printing"]);
  await addSection(page, "Sticker", stickerTitle, [{ name: "Vinyl", buttons: [["1000 Series", "30"], ["2000 Series", "35"]] }]);
  await save(page);

  // Add one new button in each section, save, reload: all the old rates are still there
  await page.reload();
  const famous = sectionEditor(page, flexTitle).getByTestId("full-group").nth(1);
  await famous.getByRole("button", { name: "+ Add a button to Most Famous Flex Names" }).click();
  await famous.getByLabel("Most Famous Flex Names button 3 text").fill("Star Flex 320 GSM");
  await famous.getByLabel("Most Famous Flex Names button 3 rate").fill("65");
  const vinyl = sectionEditor(page, stickerTitle).getByTestId("full-group").first();
  await vinyl.getByRole("button", { name: "+ Add a button to Vinyl" }).click();
  await vinyl.getByLabel("Vinyl button 3 text").fill("3000 Series");
  await vinyl.getByLabel("Vinyl button 3 rate").fill("40");
  await save(page);
  await page.reload();
  const flexRows = sectionEditor(page, flexTitle).getByTestId("full-group");
  await expect(flexRows.nth(0).getByLabel("Flex button 1 rate")).toHaveValue("45");
  await expect(flexRows.nth(0).getByLabel("Flex button 2 rate")).toHaveValue("55");
  await expect(flexRows.nth(1).getByLabel("Most Famous Flex Names button 1 rate")).toHaveValue("45");
  await expect(flexRows.nth(1).getByLabel("Most Famous Flex Names button 2 rate")).toHaveValue("90");
  await expect(flexRows.nth(1).getByLabel("Most Famous Flex Names button 3 rate")).toHaveValue("65");
  const stickerRow = sectionEditor(page, stickerTitle).getByTestId("full-group").first();
  for (const [i, rate] of ["30", "35", "40"].entries()) await expect(stickerRow.getByLabel(`Vinyl button ${i + 1} rate`)).toHaveValue(rate);

  // The website: Digital Printing, Flex Printing (shared section), China Flex (its rate pre-selected)
  await page.goto(FLEX_PRINTING);
  const flex = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: flexTitle }) });
  await expect(flex).toBeVisible();
  // China Flex card: "From Rs 45 per sq ft" and "Check price"
  const chinaCard = page.getByTestId("category-card").filter({ hasText: "China Flex" }).first();
  await expect(chinaCard.getByTestId("price-hint")).toHaveText(/From Rs 45 per sq ft/);
  await chinaCard.getByTestId("check-price").click();
  await expect(page).toHaveURL(new RegExp(`${CHINA}#rates$`));
  const onChina = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: flexTitle }) });
  await expect(onChina.getByRole("button", { name: "China Flex 240 GSM 45/-" })).toHaveAttribute("aria-pressed", "true");
  const calc = onChina.getByTestId("rate-calculator");
  await expect(calc.getByTestId("calc-rate")).toHaveValue("45/-");
  await enterSize(calc, ["6", "2"], ["3", ""]);
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-sqft")).toHaveText("21 sq ft");

  // Part 7: Reflective Flex uses the Sticker rule (3 × 6 ft → 4.5 × 6 = 27 sq ft), the note changes
  await onChina.getByRole("button", { name: "Reflective Flex 400 GSM 90/-" }).click();
  await expect(calc.getByTestId("calc-rule-note")).toHaveText(/4.5 ft/);
  await enterSize(calc, ["3", ""], ["6", ""]);
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-sqft")).toHaveText("27 sq ft");
  await onChina.getByRole("button", { name: "280 GSM 55/-" }).click();
  await expect(calc.getByTestId("calc-rule-note")).toHaveText(/next full foot/);
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-sqft")).toHaveText("18 sq ft");

  // Products: the same sections on the product category page and on its products
  await page.goto("/products/digital-printing/flex-printing");
  await expect(page.getByRole("heading", { name: flexTitle })).toBeVisible();
  const product = page.getByTestId("product-card").filter({ visible: true }).first();
  if ((await product.count()) > 0) {
    await product.click();
    await expect(page.getByRole("heading", { name: flexTitle })).toBeVisible();
  }

  // A per-unit service shows its product prices, and never the sq ft calculator
  await page.goto("/services/offset-printing");
  await expect(page.getByTestId("rate-sections")).toHaveCount(0);

  await deleteSection(page, "Digital Printing", flexTitle);
  await deleteSection(page, "Digital Printing", stickerTitle);
  await page.goto(CHINA);
  await expect(page.getByRole("heading", { name: flexTitle })).toHaveCount(0);
});

test("3D Wallpaper: fitting charges, gallery with watermarked previews, Choose this design", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "Admin editing runs on desktop");
  const run = Date.now().toString(36);
  await context.route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "WhatsApp" }));
  await signInAsAdmin(page);

  // Rates: Premium Rs 120, fitting Rs 30 per sq ft
  await allSettings(page, "3D Wallpaper");
  const section = page.getByTestId("full-section").filter({ has: page.locator("p", { hasText: "3D Wallpaper Types" }) });
  await section.getByLabel("3D Wallpaper button 2 rate").fill("120");
  await section.getByLabel("Fitting charges per sq ft").fill("30");
  await save(page);

  // Gallery: a design with a Google Drive link (Admin only)
  await page.goto("/admin/wallpaper-gallery");
  const add = page.locator("form", { has: page.getByRole("button", { name: "Add design" }) });
  const png = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#7c3aed" } }).png().toBuffer();
  await add.getByLabel("Preview image (JPG, PNG or WebP)").setInputFiles({ name: "design.png", mimeType: "image/png", buffer: png });
  await expect(add.getByText(/KB, ready to upload/)).toBeVisible();
  await add.getByLabel("Title").fill(`Marble waves ${run}`);
  await add.getByLabel("Category").selectOption({ label: "Living Room" });
  await add.getByLabel(/Print file link/).fill(`https://drive.google.com/file/d/e2e-${run}`);
  await add.getByRole("button", { name: "Add design" }).click();
  await expect(add.getByRole("status")).toHaveText(/Design added \(WP-\d{3,}\)/);
  const code = /WP-\d+/.exec((await add.getByRole("status").textContent())!)![0];
  const adminDesign = page.getByTestId("admin-design").filter({ hasText: code });
  await expect(adminDesign.getByRole("link", { name: "Open print file ↗" })).toHaveAttribute("href", `https://drive.google.com/file/d/e2e-${run}`);

  // Website: the design, without the Drive link; Choose this design fills the code
  await page.goto(WALLPAPER);
  await expect(page.locator(`a[href*="e2e-${run}"]`)).toHaveCount(0);
  const card = page.getByTestId("wallpaper-design").filter({ hasText: code });
  await expect(card.getByRole("img")).toHaveAttribute("src", /webp|_next\/image/);
  await card.getByRole("button", { name: `View ${code}` }).click();
  await expect(page.getByRole("dialog", { name: new RegExp(code) })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Choose this design" }).click();
  const rates = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: /3D Wallpaper Types/ }) });
  const calc = rates.getByTestId("rate-calculator");
  await expect(calc.getByTestId("calc-design-code")).toHaveValue(code);
  await rates.getByRole("button", { name: "Premium 120/-" }).click();
  await expect(calc.getByTestId("calc-fitting")).toHaveValue("30/-");
  // 10 ft 3 in × 8 ft → 88 sq ft × (120 + 30) + 1,000 = Rs 14,200; without fitting Rs 11,560
  await enterSize(calc, ["10", "3"], ["8", ""]);
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-total")).toHaveText("Rs 14,200");
  await expect(calc.getByTestId("calc-printing")).toHaveText("Rs 10,560");
  await expect(calc.getByTestId("calc-fitting-cost")).toHaveText(/Rs 2,640/);
  await calc.getByTestId("calc-include-fitting").uncheck();
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-total")).toHaveText("Rs 11,560");
  await calc.getByTestId("calc-include-fitting").check();
  await calc.getByRole("button", { name: "CHECK" }).click();
  await calc.getByTestId("rate-order-now").click();
  await calc.getByLabel("Your name").fill("Bilal Ahmed");
  await calc.getByLabel("Mobile number").fill("0300 7654321");
  await calc.getByLabel("City and address").fill("DHA, Lahore");
  const [whatsapp] = await Promise.all([page.context().waitForEvent("page"), calc.getByRole("button", { name: "Confirm & continue on WhatsApp" }).click()]);
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
  const message = decodeURIComponent(whatsapp.url());
  for (const text of [`Design: ${code}`, "Fitting: PKR 2,640", "Total: PKR 14,200"]) expect(message).toContain(text);

  // Gallery category page with its own address and title
  await page.goto(`${WALLPAPER}/living-room`);
  await expect(page.getByRole("heading", { level: 1, name: "Living Room 3D Wallpaper" })).toBeVisible();
  await expect(page.getByTestId("wallpaper-design").filter({ hasText: code })).toBeVisible();

  // Clean up
  await page.goto("/admin/wallpaper-gallery");
  const row = page.getByTestId("admin-design").filter({ hasText: code });
  await row.getByText("Edit").click();
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Delete design" }).click();
  await expect(page.getByTestId("admin-design").filter({ hasText: code })).toHaveCount(0);
});

test("the old Rates admin opens Categories & Services, and the menu has no separate Rates item", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop");
  await signInAsAdmin(page);
  await page.goto("/admin/rates");
  await expect(page).toHaveURL(/\/admin\/categories$/);
  const menu = page.getByRole("navigation", { name: "Admin" });
  await expect(menu.getByRole("link", { name: "Rates", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "3D Wallpaper Gallery" })).toBeVisible();
  await expect(page.getByLabel(/Designing charges/)).toHaveValue("1000");
});

test("phone browser and app: the shared Flex section on China Flex, CHECK, big buttons, no side scroll", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone layout");
  const run = Date.now().toString(36);
  const title = `E2E Phone ${run} GSM & Rate per sq ft (Rs)`;
  await signInAsAdmin(page);
  await allSettings(page, "Digital Printing");
  await addSection(page, "Flex", title, [{ name: "Most Famous Flex Names", buttons: [["China Flex 240 GSM", "45"], ["HD Star Flex 280 GSM", "55"], ["Star Flex 320 GSM", "65"], ["Korean Star 400 GSM", "85"]] }], ["— Flex Printing"]);
  await save(page);

  for (const mode of ["?app=0", "?app=1"]) {
    await page.goto(CHINA + mode);
    const section = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: title }) });
    const china = section.getByRole("button", { name: "China Flex 240 GSM 45/-" });
    await expect(china).toHaveAttribute("aria-pressed", "true");
    expect((await china.boundingBox())!.height).toBeGreaterThanOrEqual(mode === "?app=1" ? 60 : 47.5);
    const calc = section.getByTestId("rate-calculator");
    await enterSize(calc, ["4", ""], ["3", ""]);
    await calc.getByRole("button", { name: "CHECK" }).click();
    await expect(calc.getByTestId("calc-total")).toHaveText("Rs 1,540"); // 12 × 45 + 1,000
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/admin/categories?app=0");
  await deleteSection(page, "Digital Printing", title);
});
