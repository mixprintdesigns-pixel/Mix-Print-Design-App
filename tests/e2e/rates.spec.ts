import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

// Rate sections: the owner builds sections, buttons, rates and feature ticks in Admin; the service page shows the
// blue title bar, the rate buttons and the calculator. Clicking a rate fills the Rate field, CHECK shows the
// total, and Order now saves the order before WhatsApp. Each test cleans up the sections it made.

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

/** Opens the rate page of a service page in Admin, adding it the first time. */
async function openRatePage(page: Page, serviceName: string, optionLabel = serviceName) {
  await page.goto("/admin/rates");
  await expect(page.getByRole("button", { name: "Add rate page" })).toBeVisible();
  const row = page.getByTestId("rate-page-row").filter({ has: page.getByRole("link", { name: serviceName, exact: true }) });
  if ((await row.count()) > 0) await row.getByRole("link", { name: "Edit" }).click();
  else {
    await page.getByLabel("Existing service page").selectOption({ label: optionLabel });
    await page.getByRole("button", { name: "Add rate page" }).click();
  }
  await expect(page.getByRole("heading", { name: "Add a section" })).toBeVisible();
}

async function addSection(page: Page, title: string, rule: "FLEX" | "STICKER" | "SIGN_BOARD"): Promise<Locator> {
  const add = page.locator("form", { has: page.getByRole("button", { name: "Add section" }) });
  await add.getByLabel("Section title").fill(title);
  await add.getByLabel("Pricing rule").selectOption(rule);
  await add.getByRole("button", { name: "Add section" }).click();
  const section = page.getByTestId("rate-section-editor").filter({ hasText: title });
  await expect(section).toHaveCount(1);
  return section;
}

/** Adds a row / sticker type / quality to a section and opens it. */
async function addGroup(section: Locator, addLabel: string, name: string, buttonText?: string): Promise<Locator> {
  await section.getByLabel(addLabel, { exact: true }).fill(name);
  if (buttonText) await section.getByLabel("Button text", { exact: true }).fill(buttonText);
  await section.getByRole("button", { name: addLabel }).click();
  const group = section.getByTestId("rate-group-editor").filter({ hasText: name });
  await expect(group).toHaveCount(1);
  await group.locator("summary").click();
  return group;
}

/** Fills the button table and saves; waits until the row is live on the website. */
async function setButtons(group: Locator, rows: [string, string][]) {
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await group.getByRole("button", { name: "+ Add a button" }).click();
    await group.getByLabel(`Button ${i + 1} text`).fill(rows[i][0]);
    await group.getByLabel(`Button ${i + 1} rate`).fill(rows[i][1]);
  }
  await group.getByRole("button", { name: "Save", exact: true }).click();
  await expect(group.getByText("On the website")).toBeVisible();
}

async function deleteSection(page: Page, rateService: string, optionLabel: string, title: string) {
  await openRatePage(page, rateService, optionLabel);
  const section = page.getByTestId("rate-section-editor").filter({ hasText: title });
  page.once("dialog", (d) => d.accept());
  await section.getByRole("button", { name: "Delete this section" }).click();
  await expect(section).toHaveCount(0);
}

/** Enters a size in feet + inches in a calculator. */
async function enterSize(calc: Locator, w: [string, string], h: [string, string]) {
  await calc.getByLabel("Width (ft)").fill(w[0]);
  await calc.getByLabel("Width (in)").fill(w[1]);
  await calc.getByLabel("Height (ft)").fill(h[0]);
  await calc.getByLabel("Height (in)").fill(h[1]);
}

test("flex and stickers: click a rate, enter the size, CHECK, Order now; Admin edits and deletes", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "The phone test below covers phones and the app");
  const run = Date.now().toString(36);
  await stubWhatsApp(context);
  await signInAsAdmin(page);

  // Admin: a Flex section (GSM row + Most Famous Flex Names) and a Sticker section
  await openRatePage(page, "Digital Printing");
  const flex = await addSection(page, `E2E Flex ${run} GSM & Rate per sq ft (Rs)`, "FLEX");
  await setButtons(await addGroup(flex, "Add a button row", `GSM row ${run}`), [["240 GSM", "45"], ["280 GSM", "55"]]);
  await setButtons(await addGroup(flex, "Add a button row", "Most Famous Flex Names"), [["China Flex 240 GSM", "45"], ["Korean Star 400 GSM", "85"]]);
  const sticker = await addSection(page, `E2E Sticker ${run} Series & Rate per sq ft (Rs)`, "STICKER");
  await setButtons(await addGroup(sticker, "Add a sticker type", "Vinyl"), [["1000 Series", "30"], ["2000 Series", "35"]]);
  await setButtons(await addGroup(sticker, "Add a sticker type", "One Way Vision"), [["1000 Series", "40"]]);

  // Website: blue bars and rate buttons ("240 GSM" on top, "45/-" below)
  await page.goto(DIGITAL);
  const flexSection = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: `E2E Flex ${run} GSM & Rate per sq ft (Rs)` }) });
  await expect(flexSection.getByRole("heading", { level: 3, name: "Most Famous Flex Names" })).toBeVisible();
  const b280 = flexSection.getByRole("button", { name: "280 GSM 55/-" });
  await expect(b280).toBeVisible();
  const calc = flexSection.getByTestId("rate-calculator");
  await expect(calc.getByText("Enter your size – check your price")).toBeVisible();
  await expect(calc.getByTestId("calc-design")).toHaveValue("1,000/-");
  await expect(calc.getByTestId("calc-design")).toHaveAttribute("readonly", "");
  await expect(calc.getByTestId("calc-rate")).toHaveAttribute("readonly", "");

  // Clicking a rate fills the Rate field and highlights the button
  await b280.click();
  await expect(b280).toHaveAttribute("aria-pressed", "true");
  await expect(calc.getByTestId("calc-rate")).toHaveValue("55/-");
  // Rule A: 6 ft 2 in × 3 ft → 7 × 3 = 21 sq ft × 55 = 1,155 + 1,000 = Rs 2,155
  await enterSize(calc, ["6", "2"], ["3", ""]);
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-total")).toHaveText("Rs 2,155");
  await expect(calc.getByTestId("calc-size")).toHaveText("6 ft 2 in × 3 ft");
  await expect(calc.getByTestId("calc-billable")).toHaveText("7 ft × 3 ft");
  await expect(calc.getByTestId("calc-sqft")).toHaveText("21 sq ft");
  // Another button: the old total clears until CHECK
  const china = flexSection.getByRole("button", { name: "China Flex 240 GSM 45/-" });
  await china.click();
  await expect(b280).toHaveAttribute("aria-pressed", "false");
  await expect(calc.getByTestId("calc-rate")).toHaveValue("45/-");
  await expect(calc.getByTestId("calc-total")).toHaveText("—");
  await calc.getByRole("button", { name: "CHECK" }).click();
  await expect(calc.getByTestId("calc-total")).toHaveText("Rs 1,945");

  // Stickers: one column per type; Rule B case 3: 9 ft 1 in × 6 ft 2 in → 13.5 × 6.1667 = 83.25 sq ft
  const stickerSection = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: `E2E Sticker ${run} Series & Rate per sq ft (Rs)` }) });
  await expect(stickerSection.getByRole("group", { name: "Vinyl" })).toBeVisible();
  await expect(stickerSection.getByRole("group", { name: "One Way Vision" }).getByRole("button", { name: "1000 Series 40/-" })).toBeVisible();
  const sCalc = stickerSection.getByTestId("rate-calculator");
  await sCalc.getByRole("button", { name: "CHECK" }).click();
  await expect(sCalc.getByRole("alert")).toHaveText(/Choose a rate first/);
  await stickerSection.getByRole("group", { name: "Vinyl" }).getByRole("button", { name: "1000 Series 30/-" }).click();
  await enterSize(sCalc, ["9", "1"], ["6", "2"]);
  await sCalc.getByRole("button", { name: "CHECK" }).click();
  await expect(sCalc.getByTestId("calc-billable")).toHaveText("13.5 ft × 6 ft 2 in");
  await expect(sCalc.getByTestId("calc-sqft")).toHaveText("83.25 sq ft");
  await expect(sCalc.getByTestId("calc-total")).toHaveText("Rs 3,498"); // 2,497.50 + 1,000, to the nearest rupee
  // Other units: cm (152.4 × 91.44 cm = 5 × 3 ft → case 2: 4.5 × 5 = 22.5 sq ft × 30 = 675 + 1,000)
  await sCalc.getByLabel("Unit").selectOption("cm");
  await sCalc.getByLabel("Width (cm)").fill("152.4");
  await sCalc.getByLabel("Height (cm)").fill("91.44");
  await sCalc.getByRole("button", { name: "CHECK" }).click();
  await expect(sCalc.getByTestId("calc-size")).toHaveText("152.4 cm × 91.44 cm");
  await expect(sCalc.getByTestId("calc-total")).toHaveText("Rs 1,675");

  // Order now: saved first, then WhatsApp with everything
  await sCalc.getByTestId("rate-order-now").click();
  await sCalc.getByLabel("Your name").fill("Bilal Ahmed");
  await sCalc.getByLabel("Mobile number").fill("0300 7654321");
  await sCalc.getByLabel("City and address").fill("Johar Town, Lahore");
  const [whatsapp] = await Promise.all([page.context().waitForEvent("page"), sCalc.getByRole("button", { name: "Confirm & continue on WhatsApp" }).click()]);
  await expect(page).toHaveURL(/\/order\/confirmed\?n=MP-/);
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
  const message = decodeURIComponent(whatsapp.url());
  for (const text of ["*Vinyl 1000 Series*", "Option: 1000 Series", "Size: 152.4 cm × 91.44 cm", "Billable size: 5 ft × 4.5 ft", "Billable area: 22.5 sq ft", "Designing charges: PKR 1,000", "Total: PKR 1,675"]) {
    expect(message).toContain(text);
  }

  // Admin deletes a button, then the sections
  await openRatePage(page, "Digital Printing");
  const row = page.getByTestId("rate-section-editor").filter({ hasText: `E2E Flex ${run}` }).getByTestId("rate-group-editor").filter({ hasText: "Most Famous Flex Names" });
  await row.locator("summary").click();
  await row.getByLabel("Delete button 2").check();
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row.getByLabel("Button 2 text")).toHaveCount(0);
  await page.goto(DIGITAL);
  await expect(page.getByRole("button", { name: "Korean Star 400 GSM 85/-" })).toHaveCount(0);
  await deleteSection(page, "Digital Printing", "Digital Printing", `E2E Flex ${run}`);
  await deleteSection(page, "Digital Printing", "Digital Printing", `E2E Sticker ${run}`);
  await page.goto(DIGITAL);
  await expect(page.getByText(`E2E Flex ${run}`)).toHaveCount(0);
});

test("sign boards: qualities with one rate, feature ticks, description and their own calculator", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone test below covers phones and the app");
  const run = Date.now().toString(36);
  await signInAsAdmin(page);
  await openRatePage(page, "Backlit Sign Board", "— Backlit Sign Board");
  const boards = await addSection(page, `E2E Boards ${run} Rate per sq ft (Rs)`, "SIGN_BOARD");
  const premium = await addGroup(boards, "Add a quality", `Premium Board ${run}`, "Premium");
  await premium.getByLabel("Rate per sq ft (Rs)").fill("60");
  await premium.getByLabel("Waterproof").check();
  await premium.locator('textarea[name="description"]').fill("Bright LED backlit board.");
  await premium.getByRole("button", { name: "Save", exact: true }).click();
  await expect(premium.getByRole("status")).toHaveText("Saved.");

  await page.goto(BACKLIT);
  const quality = page.getByTestId("rate-quality").filter({ has: page.getByRole("heading", { name: `Premium Board ${run}` }) });
  await expect(quality.getByRole("list", { name: /What .* includes/ }).getByRole("listitem").filter({ hasText: "Waterproof" })).toContainText("✓");
  await expect(quality.getByText("LED lights (not included)")).toBeAttached();
  await expect(quality.getByText("Bright LED backlit board.")).toBeVisible();
  const button = quality.getByRole("button", { name: "Premium 60/-" });
  await button.click();
  await expect(quality.getByTestId("calc-rate")).toHaveValue("60/-");
  // 10 ft 3 in × 5 ft → 11 × 5 = 55 sq ft × 60 = 3,300 + 1,000
  await enterSize(quality, ["10", "3"], ["5", ""]);
  await quality.getByRole("button", { name: "CHECK" }).click();
  await expect(quality.getByTestId("calc-total")).toHaveText("Rs 4,300");

  await deleteSection(page, "Backlit Sign Board", "— Backlit Sign Board", `E2E Boards ${run}`);
});

test("phone browser and app: buttons scroll sideways, big tap targets, CHECK works, nothing wider than the screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone layout");
  const run = Date.now().toString(36);
  await signInAsAdmin(page);
  await openRatePage(page, "Digital Printing");
  const flex = await addSection(page, `E2E Phone ${run} GSM & Rate per sq ft (Rs)`, "FLEX");
  await setButtons(await addGroup(flex, "Add a button row", `Phone row ${run}`), [["200 GSM", "40"], ["240 GSM", "45"], ["280 GSM", "55"], ["320 GSM", "65"], ["360 GSM", "75"], ["400 GSM", "85"]]);

  for (const mode of ["?app=0", "?app=1"]) {
    await page.goto(DIGITAL + mode);
    const section = page.getByTestId("rate-section").filter({ has: page.getByRole("heading", { name: `E2E Phone ${run} GSM & Rate per sq ft (Rs)` }) });
    const b400 = section.getByRole("button", { name: "400 GSM 85/-" });
    expect((await b400.boundingBox())!.height).toBeGreaterThanOrEqual(mode === "?app=1" ? 60 : 47.5);
    await b400.scrollIntoViewIfNeeded(); // the row scrolls sideways on phones
    await b400.click();
    const calc = section.getByTestId("rate-calculator");
    await expect(calc.getByTestId("calc-rate")).toHaveValue("85/-");
    await enterSize(calc, ["4", ""], ["3", ""]);
    await calc.getByRole("button", { name: "CHECK" }).click();
    await expect(calc.getByTestId("calc-total")).toHaveText("Rs 2,020"); // 12 sq ft × 85 = 1,020 + 1,000
    expect((await calc.getByRole("button", { name: "CHECK" }).boundingBox())!.height).toBeGreaterThanOrEqual(mode === "?app=1" ? 47.5 : 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/admin/rates?app=0");
  await deleteSection(page, "Digital Printing", "Digital Printing", `E2E Phone ${run}`);
});
