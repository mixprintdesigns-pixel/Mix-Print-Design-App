import { expect, test, type Page } from "@playwright/test";
import { crc32, deflateSync } from "node:zlib";

// Design work, Customers, Payments and Reports admin sections, plus the customer's design approval page.

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
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", pixels), chunk("IEND", Buffer.alloc(0))]);
}

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("admin sections", () => {
  test.skip(({ isMobile }) => isMobile, "Admin workflow is covered on desktop");

  test("design proof approval, payments, customers and reports", async ({ page }) => {
    const run = Date.now().toString(36);
    const customer = `Section Customer ${run}`;
    await signInAsAdmin(page);

    // An order to work with
    await page.goto("/admin/orders");
    await page.getByLabel("Customer name").fill(customer);
    await page.getByLabel("Phone / WhatsApp").fill(`0333 ${String(Date.now()).slice(-7)}`);
    await page.getByLabel("Item 1 description").fill("Glitter sign board");
    await page.getByLabel("Item 1 quantity").fill("1");
    await page.getByLabel("Item 1 total").fill("8000");
    await page.getByRole("button", { name: "Record order" }).click();
    const recorded = page.getByRole("status").filter({ hasText: /Order MP-\w+ recorded/ });
    await expect(recorded).toBeVisible();
    const number = (await recorded.textContent())!.match(/MP-\w+/)![0];

    // The menu has no "(soon)" sections left
    await expect(page.getByRole("navigation", { name: "Admin" })).not.toContainText("(soon)");

    // Design work: add the order, upload a proof
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Design work" }).click();
    await page.getByLabel("Order number").fill(number);
    await page.getByRole("button", { name: "Add to design work" }).click();
    const job = page.getByTestId("design-job").filter({ hasText: number });
    await expect(job).toContainText("Pending");
    await job.getByLabel(`Proof file for ${number}`).setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: solidPng(0, 175, 239) });
    await job.getByRole("button", { name: "Upload proof" }).click();
    await expect(job).toContainText("Sent for approval");
    const link = (await job.getByTestId("approval-link").textContent())!.trim();
    const path = new URL(link).pathname;

    // The customer asks for changes on their approval link
    await page.goto(path);
    await expect(page.getByRole("heading", { name: `Your design for order ${number}` })).toBeVisible();
    await page.getByLabel(/Comments/).fill("Please make the text bigger");
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "We received your comments" })).toBeVisible();

    await page.goto("/admin/designs");
    await expect(job).toContainText("In progress");
    await expect(job).toContainText("Customer: Please make the text bigger");

    // Payments: 3,000 by JazzCash leaves it Partial
    await page.goto("/admin/payments");
    await page.getByLabel("Order number").fill(number);
    await page.getByLabel("Amount (Rs)").fill("3000");
    await page.getByLabel("Method").selectOption("JAZZCASH");
    await page.getByLabel("Reference (optional)").fill(`TXN${run}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Payment recorded for ${number}` })).toBeVisible();
    const orderRow = page.getByTestId("payment-order-row").filter({ hasText: number });
    await expect(orderRow).toContainText("Partial");
    await expect(orderRow).toContainText("PKR 5,000");
    await expect(page.getByTestId("recorded-payment").filter({ hasText: number })).toContainText("JazzCash");

    // Customers: search, open, save a note
    await page.goto("/admin/customers");
    await page.getByLabel("Search by name, phone or email").fill(customer);
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByTestId("customer-row").getByRole("link", { name: customer }).click();
    await expect(page.getByRole("heading", { name: customer })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(number);
    await page.getByRole("textbox", { name: "Internal notes" }).fill("Wants installation on Saturday");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Notes saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Internal notes" })).toHaveValue("Wants installation on Saturday");

    // Reports
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Sales by day" })).toBeVisible();
    await expect(page.getByTestId("unpaid-row").filter({ hasText: number })).toContainText("PKR 5,000");
    await page.getByRole("link", { name: "By month" }).click();
    await expect(page.getByRole("heading", { name: "Sales by month" })).toBeVisible();
  });
});
