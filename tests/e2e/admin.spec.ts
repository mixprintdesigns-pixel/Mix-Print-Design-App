import { expect, test, type Page } from "@playwright/test";

import { crc32, deflateSync } from "node:zlib";

/** A valid solid-colour PNG, so uploads are real, decodable images. */
function solidPng(r: number, g: number, b: number, size = 16): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", pixels),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const RED_PNG = solidPng(220, 30, 60);
const BLUE_PNG = solidPng(20, 110, 220);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("admin catalog management", () => {
  test.skip(({ isMobile }) => isMobile, "Admin workflow is covered on desktop");

  test("create, illustrate and publish a product, then buy it", async ({ page }) => {
    const run = Date.now().toString(36);
    const productName = `E2E Stickers ${run}`;
    const categoryName = `E2E Sheets ${run}`;

    await signIn(page, "admin@mixprint.local", "ChangeMe12345");
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Subcategory under an existing category
    await page.goto("/admin/categories");
    await page.getByLabel("Name", { exact: true }).fill(categoryName);
    await page.getByLabel("Inside").selectOption({ label: "— Stickers & Labels" });
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("category-row").filter({ hasText: categoryName })).toContainText("Sub-category");

    // New product
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(productName);
    await expect(page.getByLabel("URL slug")).toHaveValue(`e2e-stickers-${run}`);
    await page.getByLabel("SKU (unique product code)").fill(`E2E-${run}`);
    await page.getByLabel("Service", { exact: true }).selectOption({ label: "Offset Printing" });
    await page.getByLabel("Category").selectOption({ label: `— — ${categoryName}` });
    await page.getByLabel("Short description").fill("Test sticker sheets");
    await page.getByLabel("Full description").fill("Created by the end-to-end test.");
    await page.getByLabel("Base price per unit (PKR)").fill("5");
    await page.getByLabel("Minimum quantity").fill("100");
    await page.getByLabel("Quantity step").fill("100");
    await page.getByLabel("Production time (working days)").fill("2");
    // Commission in rupees, with the percentage worked out from the starting order price (100 × Rs 5 = Rs 500).
    await page.getByLabel("Commission per order (Rs)").fill("50");
    await expect(page.getByTestId("commission-percent")).toContainText("= 10%");

    await page.getByRole("button", { name: "+ Add tier" }).click();
    await page.getByLabel("From quantity").first().fill("200");
    await page.getByLabel("Unit price (PKR)").fill("4");
    await page.getByRole("button", { name: "+ Add discount" }).click();
    await page.getByLabel("From quantity").nth(1).fill("200");
    await page.getByLabel("Discount %").fill("10");

    await page.getByRole("button", { name: "Add option" }).click();
    await page.getByLabel("Option name").fill("Size");
    await page.getByLabel("Type").selectOption("SIZE");
    await page.getByLabel("Value", { exact: true }).fill("Small");
    await page.getByRole("button", { name: "+ Add value" }).click();
    await page.getByLabel("Value", { exact: true }).nth(1).fill("Large");
    await page.getByLabel("Extra (PKR)").nth(1).fill("2");

    await page.getByRole("button", { name: "Add option" }).click();
    await page.getByLabel("Option name").nth(1).fill("Setup");
    await page.getByLabel("Value", { exact: true }).nth(2).fill("Cutting plate");
    await page.getByLabel("Extra (PKR)").nth(2).fill("500");
    await page.getByLabel("Charged").nth(2).selectOption("PER_ORDER");

    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Product created as a draft")).toBeVisible();
    // Next.js keeps the previous page (the "new product" form) mounted but hidden, so target the visible editor.
    const editor = page.locator("form").filter({ visible: true }).filter({ hasText: "Pricing and quantities" });

    // Publishing needs an image
    await editor.getByLabel("Publication status").selectOption("PUBLISHED");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Add at least one image" })).toBeVisible();

    // Upload two images, reject a non-image, then make the second one main
    await page.getByTestId("image-upload").setInputFiles([
      { name: "red.png", mimeType: "image/png", buffer: RED_PNG },
      { name: "blue.png", mimeType: "image/png", buffer: BLUE_PNG },
    ]);
    await expect(page.getByText("2 images uploaded.")).toBeVisible();
    await expect(page.getByTestId("admin-image")).toHaveCount(2);

    await page.getByTestId("image-upload").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
    await expect(page.getByRole("alert").filter({ hasText: "Use a JPG, PNG or WebP image" })).toBeVisible();
    await expect(page.getByTestId("admin-image")).toHaveCount(2);

    await page.getByTestId("admin-image").nth(1).getByLabel("Image description").fill("Blue sheet");
    await page.getByTestId("admin-image").nth(1).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Description saved.")).toBeVisible();
    await page.getByTestId("admin-image").nth(1).getByRole("button", { name: "Make main" }).click();
    await expect(page.getByText("Main image updated.")).toBeVisible();
    await expect(page.getByTestId("admin-image").first().getByLabel("Image description")).toHaveValue("Blue sheet");

    await editor.getByLabel("Publication status").selectOption("PUBLISHED");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Product saved and visible in the store.")).toBeVisible();

    // It appears automatically in its category, its parents' listings and on the Services page.
    await page.goto(`/services/offset-printing/stickers-labels/e2e-sheets-${run}`);
    await expect(page.getByRole("heading", { level: 1, name: categoryName })).toBeVisible();
    await expect(page.getByTestId("product-card").filter({ hasText: productName })).toBeVisible();
    await page.goto("/products/offset-printing");
    await expect(page.getByTestId("product-card").filter({ hasText: productName })).toBeVisible();

    // Customer view: subcategory, gallery, price, WhatsApp order
    await page.goto("/products/offset-printing/stickers-labels");
    await page.getByRole("navigation", { name: "Stickers & Labels types" }).getByRole("link", { name: new RegExp(categoryName) }).click();
    await page.getByRole("link", { name: new RegExp(productName) }).click();
    await expect(page).toHaveURL(new RegExp(`/products/offset-printing/stickers-labels/e2e-sheets-${run}/e2e-stickers-${run}$`));
    await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("button")).toHaveCount(2);
    await expect(page.getByRole("img", { name: "Blue sheet" }).first()).toBeVisible();

    const total = page.getByTestId("live-total");
    await expect(total).toHaveText("PKR 1,000"); // 100 × 5 + 500 plate
    await page.getByText("Large").click();
    await page.getByLabel("Quantity").fill("200");
    // (4 + 2) × 200 = 1,200 − 10% = 1,080 + 500 plate
    await expect(total).toHaveText("PKR 1,580");
    const href = decodeURIComponent((await page.getByTestId("order-whatsapp").getAttribute("href"))!);
    expect(href).toContain(`*${productName}*`);
    expect(href).toContain("Size: Large");
    expect(href).toContain("Price shown: PKR 1,580");
  });

  test("customers cannot open the admin area", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Curious Customer");
    await page.getByLabel("Email").fill(`curious-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("MixPrint2026!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/admin/products/new");
    await expect(page).toHaveURL(/\/$/);
  });
});

test("catalog sorting and filters", async ({ page }) => {
  await page.goto("/products?sort=price-desc");
  await expect(page.getByTestId("product-card").first()).toContainText("Roll-up Standee");

  await page.goto("/products");
  await page.getByLabel("Production time").selectOption("2");
  await expect(page).toHaveURL(/maxDays=2/);
  await expect(page.getByRole("link", { name: /A5 Flyers/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mailer Boxes/ })).toHaveCount(0);

  await page.getByLabel("Sort by").selectOption("name");
  await expect(page).toHaveURL(/sort=name/);
  await expect(page).toHaveURL(/maxDays=2/);
});

test.describe("WhatsApp orders", () => {
  test.skip(({ isMobile }) => isMobile, "Admin workflow is covered on desktop");

  test("staff record a WhatsApp order", async ({ page }) => {
    const run = Date.now().toString(36);
    await signIn(page, "admin@mixprint.local", "ChangeMe12345");
    await page.goto("/admin/orders");
    await page.getByLabel("Customer name").fill(`Customer ${run}`);
    await page.getByLabel("Phone / WhatsApp").fill("0300 7654321");
    await page.getByLabel("Item 1 description").fill("Matte business cards");
    await page.getByLabel("Item 1 quantity").fill("1000");
    await page.getByLabel("Item 1 total").fill("4500");
    await page.getByRole("button", { name: "Record order" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Order MP-\w+ recorded\./ })).toBeVisible();
    const row = page.getByTestId("admin-order").filter({ hasText: `Customer ${run}` });
    await expect(row).toContainText("1000 × Matte business cards");
    await expect(row).toContainText("PKR 4,500");
    await expect(row).toContainText("WhatsApp");
  });
});

test("WhatsApp messages carry the affiliate code of a referred visitor", async ({ page, context }) => {
  await context.addCookies([{ name: "mp_ref_code", value: "TEST1234", url: "http://localhost:3100" }]);
  await page.goto("/products/offset-printing/business-cards/standard-business-cards");
  await page.getByLabel("Quantity").fill("500");
  await expect
    .poll(async () => decodeURIComponent((await page.getByTestId("order-whatsapp").getAttribute("href")) ?? ""))
    .toMatch(/Quantity: 500[\s\S]*Ref: TEST1234$/);
  await expect
    .poll(async () => decodeURIComponent((await page.getByTestId("whatsapp-float").getAttribute("href")) ?? ""))
    .toContain("Ref: TEST1234");
});
