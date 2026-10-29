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

test.describe("services", () => {
  test("services page shows the initial categories and Board Maker sub-types", async ({ page }) => {
    await page.goto("/services");
    for (const title of ["Board Maker", "Offset Printing", "Digital Printing"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await page.getByRole("link", { name: "View Board Maker →" }).click();
    await expect(page).toHaveURL(/\/services\/board-maker$/);
    await expect(page.getByTestId("service-subtype")).toHaveCount(3);
    const backlit = page.locator("#backlit");
    await expect(backlit.getByRole("link", { name: "Get Quote for Board Maker / Backlit", exact: true })).toHaveAttribute(
      "href",
      "/contact?subject=Quote%3A%20Board%20Maker%20%2F%20Backlit",
    );
    await expect(backlit.getByRole("link", { name: "WhatsApp about Board Maker / Backlit", exact: true })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/923034889255\?text=.*Backlit/,
    );
  });

  test("admin adds a quality and links a product; it appears on the services page automatically", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "Admin workflow runs on desktop");
    const run = Date.now().toString(36);
    const qualityTitle = `Ultra ${run}`;
    const admin = await adminPage(browser);
    await admin.goto("/admin/services");

    const backlit = admin.getByTestId("admin-subtype").filter({ has: admin.getByRole("heading", { name: "Backlit", exact: true }) });
    await backlit.getByText("+ Add quality to Backlit").click();
    const addForm = backlit.locator("form").filter({ has: admin.getByRole("button", { name: "Add quality" }) });
    await addForm.getByLabel("Title").fill(qualityTitle);
    await addForm.getByLabel("Short description").fill("Our brightest backlit quality.");
    await addForm.getByRole("button", { name: "Add quality" }).click();
    const quality = admin.getByTestId("admin-quality").filter({ hasText: qualityTitle });
    await expect(quality).toBeVisible();

    await quality.getByLabel(`Link a product to ${qualityTitle}`).selectOption({ label: "Vinyl Flex Banner (moves it here)" });
    await quality.getByRole("button", { name: "Link", exact: true }).click();
    await expect(quality.getByTestId("linked-product")).toContainText("Vinyl Flex Banner");

    await page.goto("/services/board-maker#backlit");
    const card = page.getByTestId("service-quality").filter({ hasText: qualityTitle });
    await expect(card).toBeVisible();
    await expect(page.getByRole("list", { name: `${qualityTitle} products` }).getByRole("link", { name: /Vinyl Flex Banner/ })).toBeVisible();

    // Hide the quality: it disappears from the website
    await quality.getByText("Edit quality").click();
    await quality.getByLabel("Visible on the website").uncheck();
    await quality.getByRole("button", { name: "Save" }).click();
    await expect(quality).toContainText("hidden");
    await page.reload();
    await expect(page.getByTestId("service-quality").filter({ hasText: qualityTitle })).toHaveCount(0);

    // Put the product back under Digital Printing for other tests
    const digital = admin.getByTestId("admin-service").filter({ has: admin.getByRole("heading", { name: "Digital Printing" }) });
    await digital.getByLabel("Link a product to Digital Printing").first().selectOption({ label: "Vinyl Flex Banner (moves it here)" });
    await digital.getByRole("button", { name: "Link", exact: true }).first().click();
    await expect(digital.getByTestId("linked-product").filter({ hasText: "Vinyl Flex Banner" }).first()).toBeVisible();
  });
});

test.describe("about page", () => {
  test("shows placeholder content and updates from admin", async ({ page, browser, isMobile }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lahore");
    await expect(page.getByText("Raiwind Road, Lahore, Pakistan").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why choose us" })).toBeVisible();
    test.skip(isMobile, "Admin part runs on desktop");

    const run = Date.now().toString(36);
    const admin = await adminPage(browser);
    await admin.goto("/admin/about");
    await admin.getByLabel("Owner name").fill(`Owner ${run}`);
    await admin.getByLabel("Short bio").fill("Twenty years of printing experience in Lahore.");
    await admin.getByLabel("Highlight 1 title").fill(`Fast turnaround ${run}`);
    await admin.getByRole("button", { name: "Save About page" }).click();
    await expect(admin.getByText("About page saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: `Owner ${run}` })).toBeVisible();
    await expect(page.getByText("Twenty years of printing experience in Lahore.")).toBeVisible();
    await expect(page.getByRole("heading", { name: `Fast turnaround ${run}` })).toBeVisible();
  });
});

test.describe("contact page", () => {
  test("shows contact details and map, and sends a quote request to the admin inbox", async ({ browser, isMobile }) => {
    // A unique client IP per run keeps the contact form's rate limit from affecting repeated test runs.
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
    const page = await context.newPage();
    const run = Date.now().toString(36);

    await page.goto("/services/board-maker");
    await page.getByRole("link", { name: "Get Quote for Board Maker / 3D", exact: true }).click();
    await expect(page).toHaveURL(/\/contact\?subject=/);
    await expect(page.getByLabel("Subject (optional)")).toHaveValue("Quote: Board Maker / 3D");

    await expect(page.getByRole("link", { name: "+92 303 488 9255" }).first()).toHaveAttribute("href", "tel:+923034889255");
    await expect(page.getByRole("link", { name: "mixprintdesigns@gmail.com" })).toHaveAttribute("href", "mailto:mixprintdesigns@gmail.com");
    await expect(page.getByRole("link", { name: "facebook.com/mixprintdesign" })).toHaveAttribute("href", "https://facebook.com/mixprintdesign");
    await expect(page.getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/923034889255/);
    await expect(page.getByTitle("Mix Print Design location on Google Maps")).toHaveAttribute("src", /google\.com\/maps\?q=.*Raiwind/);

    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill(`Visitor ${run}`);
    await page.getByLabel("Email", { exact: true }).fill(`visitor-${run}@example.com`);
    await page.getByLabel("Phone / WhatsApp").fill("0300 1234567");
    await page.getByLabel("Message", { exact: true }).fill("Please quote a 3D steel letter sign, 8 ft wide.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("Your message has been sent");

    if (isMobile) return;
    const admin = await adminPage(browser);
    await admin.goto("/admin/messages");
    const message = admin.getByTestId("contact-message").filter({ hasText: `Visitor ${run}` });
    await expect(message).toContainText("Quote: Board Maker / 3D");
    await expect(message).toContainText("Please quote a 3D steel letter sign");
    await expect(message).toContainText("Not emailed"); // no email key in the test environment
    await message.getByRole("button", { name: "Mark as handled" }).click();
    await expect(message).toHaveCount(0);
  });
});
