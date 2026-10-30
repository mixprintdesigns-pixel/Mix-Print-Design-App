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

test("footer shows contact details and social links", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer.getByText("Raiwind Road, Lahore, Pakistan")).toBeVisible();
  await expect(footer.getByRole("link", { name: "+92 303 488 9255" })).toHaveAttribute("href", "tel:+923034889255");
  await expect(footer.getByRole("link", { name: "mixprintdesigns@gmail.com" })).toHaveAttribute("href", "mailto:mixprintdesigns@gmail.com");
  await expect(footer.getByRole("link", { name: /^Facebook/ })).toHaveAttribute("href", "https://facebook.com/mixprintdesign");
  await expect(footer.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute("href", "https://wa.me/923034889255");
});

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
    await expect(page.getByRole("link", { name: "View Services" })).toHaveAttribute("href", "/services");
    await expect(page.getByRole("main").getByRole("link", { name: "Order on WhatsApp", exact: true })).toHaveAttribute("href", /^https:\/\/wa\.me\/923034889255\?text=/);

    const headings = await page.locator("main h2").allTextContents();
    const order = ["Our services", "Top products", "Share Mix Print Design", "What our customers say"].map((h) => headings.findIndex((x) => x.includes(h)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const top = page.getByRole("region", { name: "Top products" });
    await expect(top.getByRole("link", { name: /Standard Business Cards/ })).toBeVisible();

    const services = page.getByRole("region", { name: "Our services" });
    await expect(services.getByTestId("category-card")).toHaveCount(4);
    await expect(services.getByRole("link", { name: "Sign Board Maker", exact: true })).toHaveAttribute("href", "/services/board-maker");
    await expect(services.getByRole("link", { name: "Customized Printing", exact: true })).toHaveAttribute("href", "/services/customized-printing");
    await expect(page.getByRole("region", { name: "Shop by category" }).getByRole("link", { name: "Business Cards", exact: true })).toHaveAttribute(
      "href",
      "/products/offset-printing/business-cards",
    );

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
  test("four main services drill down service → category → sub-category, with breadcrumbs and quotes", async ({ page }) => {
    await page.goto("/services");
    await expect(page.locator("h1")).toHaveCount(1);
    for (const title of ["Sign Board Maker", "Offset Printing", "Digital Printing", "Customized Printing"]) {
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    }
    // Only the main services: deeper levels are never listed on a parent page.
    await expect(page.getByTestId("category-card")).toHaveCount(4);
    await expect(page.getByText("Backlit Sign Board")).toHaveCount(0);

    await page.getByRole("link", { name: "Sign Board Maker", exact: true }).click();
    await expect(page).toHaveURL(/\/services\/board-maker$/);
    const categories = page.getByRole("region", { name: "Sign Board Maker types" });
    await expect(categories.getByRole("heading", { level: 3 })).toHaveText(["3D Sign Board", "Backlit Sign Board", "Front-lit Sign Board"]);
    await expect(page.getByRole("link", { name: "← Back to all services" })).toHaveAttribute("href", "/services");

    await categories.getByRole("link", { name: "3D Sign Board", exact: true }).click();
    await expect(page).toHaveURL(/\/services\/board-maker\/3d-sign-board$/);
    await expect(page.getByRole("heading", { level: 1, name: "3D Sign Board" })).toBeVisible();
    await expect(page.getByRole("link", { name: "← Back to Sign Board Maker" })).toHaveAttribute("href", "/services/board-maker");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Services›Sign Board Maker›3D Sign Board");
    const types = page.getByRole("region", { name: "3D Sign Board types" });
    await expect(types.getByRole("heading", { level: 3 })).toHaveText([
      "Simple Acrylic Sign",
      "Logo Board with Acrylic Sign",
      "Frame with Acrylic Sign",
      "Aluminium with Acrylic Sign",
      "Glitter Sign",
    ]);
    await expect(types.getByText("Get Quote").first()).toBeVisible(); // no price set → Get Quote
    await expect(page.getByRole("link", { name: "Get Quote for Sign Board Maker / 3D Sign Board", exact: true }).first()).toHaveAttribute(
      "href",
      "/contact?subject=Quote%3A%20Sign%20Board%20Maker%20%2F%203D%20Sign%20Board",
    );
    await expect(page.getByRole("link", { name: "Order on WhatsApp about Sign Board Maker / 3D Sign Board", exact: true }).first()).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/923034889255\?text=.*3D%20Sign%20Board/,
    );

    // Backlit and Front-lit each have Normal, Medium and Premium.
    for (const board of ["backlit-sign-board", "front-lit-sign-board"]) {
      await page.goto(`/services/board-maker/${board}`);
      await expect(page.getByRole("region", { name: / types$/ }).getByRole("heading", { level: 3 })).toHaveText([/^Normal/, /^Medium/, /^Premium/]);
    }
    await page.goto("/services/board-maker/3d-sign-board");
    await types.getByRole("link", { name: "Glitter Sign", exact: true }).click();
    await expect(page).toHaveURL(/\/services\/board-maker\/3d-sign-board\/glitter-sign$/);
    await expect(page.getByRole("heading", { level: 1, name: "Glitter Sign" })).toBeVisible();

    // The Products page uses the same tree.
    await page.goto("/products/digital-printing/flex-printing");
    await expect(page.getByRole("heading", { level: 1, name: "Flex Printing" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Flex Printing types" }).getByRole("link")).toHaveText([
      /China Flex/,
      /HD Star Flex/,
      /^Star Flex/,
      /Korean Star Flex/,
    ]);
    await page.goto("/services/customized-printing");
    await expect(page.getByRole("region", { name: "Customized Printing types" }).getByTestId("category-card")).toHaveCount(12);
  });

  test("admin adds a priced sub-category; it appears on Services and Products, and hiding removes it", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "Admin workflow runs on desktop");
    const run = Date.now().toString(36);
    const name = `Ultra Backlit ${run}`;
    const admin = await adminPage(browser);
    await admin.goto("/admin/categories");
    await expect(admin.getByRole("heading", { level: 1, name: "Categories & Services" })).toBeVisible();
    const form = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Add category" }) });
    await form.getByLabel("Name", { exact: true }).fill(name);
    await form.getByLabel("Inside").selectOption({ label: "— Backlit Sign Board" });
    await form.getByLabel("Short description").fill("Our brightest backlit board.");
    await form.getByLabel("Starting price (Rs)").fill("450");
    await form.getByLabel("Price unit").fill("per sq. ft");
    await form.getByRole("button", { name: "Add category" }).click();
    const row = admin.getByTestId("category-row").filter({ hasText: name });
    await expect(row).toContainText(`/board-maker/backlit-sign-board/ultra-backlit-${run}`);

    await page.goto("/services/board-maker/backlit-sign-board");
    const card = page.getByTestId("category-card").filter({ hasText: name });
    await expect(card).toContainText("From PKR 450 per sq. ft");
    await page.goto("/products/board-maker/backlit-sign-board");
    await expect(page.getByRole("navigation", { name: "Backlit Sign Board types" }).getByRole("link", { name: new RegExp(name) })).toBeVisible();

    await row.getByRole("button", { name: `Hide ${name}` }).click();
    await expect(row).toContainText("Hidden");
    await page.goto("/services/board-maker/backlit-sign-board");
    await expect(page.getByTestId("category-card").filter({ hasText: name })).toHaveCount(0);
    await page.goto(`/services/board-maker/backlit-sign-board/ultra-backlit-${run}`);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
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

    await page.goto("/services/board-maker/3d-sign-board");
    await page.getByRole("link", { name: "Get Quote for Sign Board Maker / 3D Sign Board", exact: true }).first().click();
    await expect(page).toHaveURL(/\/contact\?subject=/);
    await expect(page.getByLabel("Subject (optional)")).toHaveValue("Quote: Sign Board Maker / 3D Sign Board");

    await expect(page.getByRole("link", { name: "+92 303 488 9255" }).first()).toHaveAttribute("href", "tel:+923034889255");
    await expect(page.getByRole("main").getByRole("link", { name: "mixprintdesigns@gmail.com" })).toHaveAttribute("href", "mailto:mixprintdesigns@gmail.com");
    await expect(page.getByRole("main").getByRole("link", { name: "facebook.com/mixprintdesign" })).toHaveAttribute("href", "https://facebook.com/mixprintdesign");
    await expect(page.getByRole("main").getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/923034889255/);
    await expect(page.getByTestId("whatsapp-float")).toHaveAttribute("href", /^https:\/\/wa\.me\/923034889255\?text=/);
    await expect(page.getByTitle("Mix Print Design location on Google Maps")).toHaveAttribute("src", /google\.com\/maps\?q=.*Raiwind/);

    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill(`Visitor ${run}`);
    await page.getByLabel("Email", { exact: true }).fill(`visitor-${run}@example.com`);
    await page.getByLabel("Phone / WhatsApp").fill("0300 1234567");
    await page.getByLabel("Service", { exact: true }).selectOption("Sign Board Maker");
    await page.getByLabel("Message", { exact: true }).fill("Please quote a 3D steel letter sign, 8 ft wide.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("Your message has been sent");

    if (isMobile) return;
    const admin = await adminPage(browser);
    await admin.goto("/admin/messages");
    const message = admin.getByTestId("contact-message").filter({ hasText: `Visitor ${run}` });
    await expect(message).toContainText("Quote: Sign Board Maker / 3D Sign Board");
    await expect(message).toContainText("Service: Sign Board Maker");
    await expect(message).toContainText("Please quote a 3D steel letter sign");
    await expect(message).toContainText("Not emailed"); // no email key in the test environment
    await message.getByRole("button", { name: "Mark as handled" }).click();
    await expect(message).toHaveCount(0);
  });
});

test.describe("AI chat assistant", () => {
  test("is on every page and answers from site content with links", async ({ browser }) => {
    const context = await browser.newContext({
      ...(test.info().project.use ?? {}),
      extraHTTPHeaders: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    });
    const page = await context.newPage();
    for (const path of ["/", "/services", "/about", "/contact", "/products"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Open chat assistant" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Open chat assistant" }).click();
    const chat = page.getByRole("dialog", { name: "Mix Print Design assistant" });
    await expect(chat).toBeVisible();
    await expect(chat.getByTestId("chat-answer").first()).toContainText("Mix Print Design assistant");
    await expect(chat.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/923034889255");

    await chat.getByRole("button", { name: "Do you make backlit boards?" }).click();
    const answer = chat.getByTestId("chat-answer").nth(1);
    await expect(answer).toContainText("Backlit");
    // Links to the matching Sign Board Maker service pages.
    const link = answer.locator("a[href^='/services/board-maker']").first();
    await expect(link).toBeVisible();
    const target = (await link.getAttribute("href"))!;

    // The chat panel must fit inside a phone screen
    const box = await chat.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    // Conversation is kept while browsing
    await page.getByRole("button", { name: "Open chat assistant" }).click();
    await expect(page.getByTestId("chat-question")).toContainText("Do you make backlit boards?");

    await page.getByLabel("Your question").fill("affiliate commission withdrawal");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("chat-answer").last().getByRole("link", { name: "Affiliate program" })).toHaveAttribute("href", "/affiliate");
  });

  test("the chat API validates input and keeps keys server-side", async ({ request }) => {
    const bad = await request.post("/api/chat", { data: { message: "" } });
    expect(bad.status()).toBe(400);
    const ok = await request.post("/api/chat", { data: { message: "business cards", history: [] }, headers: { "x-forwarded-for": `10.7.${Date.now() % 250}.1` } });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body).toHaveProperty("answer");
    expect(JSON.stringify(body)).not.toMatch(/sk-ant|ANTHROPIC/);
  });
});

test.describe("navigation", () => {
  const pages = [
    ["Home", /\/$/],
    ["Services", /\/services$/],
    ["Products", /\/products$/],
    ["Affiliate Program", /\/affiliate$/],
    ["About Us", /\/about$/],
    ["Contact Us", /\/contact$/],
  ] as const;

  test("the header shows exactly the six main pages, in order", async ({ page, isMobile }) => {
    await page.goto("/");
    const nav = isMobile ? page.getByRole("navigation", { name: "Mobile" }) : page.getByRole("navigation", { name: "Main" });
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(nav.getByRole("link")).toHaveText(pages.map(([label]) => label));
    await expect(page.locator("header").getByRole("link", { name: /Business cards|Marketing/i })).toHaveCount(0);
  });

  test("header links on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop header");
    await page.goto("/products");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const [label, url] of pages) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });

  test("mobile menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile menu");
    await page.goto("/products");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    for (const [label, url] of pages) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden(); // closes after navigating
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
