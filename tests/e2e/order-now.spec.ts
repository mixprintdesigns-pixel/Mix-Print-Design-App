import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { latestCode, randomMobile } from "./support/outbox";

// "Order now" saves the order before WhatsApp opens. Journey: affiliate link in a private window → Order now →
// the order is in Admin with the affiliate → marked Fully Paid → the commission is Approved on the affiliate's dashboard.

test.skip(({ isMobile }) => isMobile, "Covered on desktop");

const PRODUCT = "/products/offset-printing/business-cards/standard-business-cards";

/** WhatsApp is outside the test network: answer it locally so the new tab's address can be checked. */
async function stubWhatsApp(context: BrowserContext) {
  await context.route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "WhatsApp" }));
}

async function signInAsAdmin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return page;
}

async function orderNow(page: Page, name: string, phone: string) {
  await page.getByText("Front & back").click();
  await page.getByLabel("Quantity").fill("500");
  await page.getByLabel(/Note for our team/).fill("Logo on both sides");
  await page.getByTestId("order-now").click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Mobile / WhatsApp number").fill(phone);
  await page.getByLabel("City and address").fill("Johar Town, Lahore");
  const [whatsapp] = await Promise.all([page.context().waitForEvent("page"), page.getByTestId("place-order").click()]);
  await expect(page).toHaveURL(/\/order\/confirmed\?n=MP-/);
  const number = (await page.getByTestId("order-number").textContent())!.replace("Order #", "").trim();
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
  return { number, whatsappMessage: decodeURIComponent(whatsapp.url()) };
}

test("Order now saves the order, opens WhatsApp with the order number and shows a confirmation", async ({ page, context }) => {
  await stubWhatsApp(context);
  await page.goto(PRODUCT);
  // Details are needed before the order is saved
  await page.getByTestId("order-now").click();
  await page.getByTestId("place-order").click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter your name.");

  await page.reload();
  const { number, whatsappMessage } = await orderNow(page, "Bilal Ahmed", "0300 7654321");
  expect(whatsappMessage).toMatch(/^https:\/\/wa\.me\/923034889255\?text=/);
  for (const text of [`Order #${number}`, "*Standard Business Cards*", "Printed sides: Front & back", "Quantity: 500", "Name: Bilal Ahmed", "City / address: Johar Town, Lahore", "Note: Logo on both sides"]) {
    expect(whatsappMessage).toContain(text);
  }
  await expect(page.getByTestId("continue-whatsapp")).toHaveAttribute("href", new RegExp(`Order%20%23${number}`));
  await expect(page.getByTestId("order-total")).toContainText("PKR");
});

test("affiliate link → Order now → order in Admin with the affiliate → Fully Paid → commission Approved", async ({ browser }) => {
  const run = Date.now().toString(36);
  const email = `order-aff-${run}@example.com`;
  const mobile = randomMobile();

  // An approved affiliate
  const affiliate = await (await browser.newContext()).newPage();
  await affiliate.goto("/affiliate/join");
  await affiliate.getByLabel("Full name").fill("Hamza Tariq");
  await affiliate.getByLabel("Email").fill(email);
  await affiliate.getByLabel("Mobile number (Pakistan)").fill(mobile.local);
  await affiliate.getByLabel("Password").fill("MixPrint2026!");
  await affiliate.getByLabel("Wallet mobile number").fill(mobile.local);
  await affiliate.getByLabel("How will you promote Mix Print Design?").fill("WhatsApp groups for shop owners.");
  await affiliate.getByLabel(/I agree to the/).check();
  await affiliate.getByRole("button", { name: /Create account & send code/ }).click();
  await expect(affiliate).toHaveURL(/\/affiliate\/verify$/);
  await affiliate.getByLabel("Email code").fill(await latestCode("email", email));
  await affiliate.getByRole("button", { name: "Verify & activate" }).click();
  await expect(affiliate).toHaveURL(/\/affiliate\/dashboard\?joined=1$/);

  const admin = await signInAsAdmin(browser);
  await admin.goto(`/admin/affiliates?q=${encodeURIComponent(email)}`);
  const affiliateRow = admin.getByTestId("affiliate-row").filter({ hasText: email });
  await affiliateRow.getByRole("button", { name: "Approve" }).click();
  await expect(affiliateRow.getByRole("status")).toHaveText("Affiliate approved.");
  await affiliate.goto("/affiliate/dashboard");
  const link = await affiliate.getByTestId("referral-link").inputValue();
  const code = link.split("/r/")[1];

  // A customer opens the affiliate link in a private window and orders
  const customerContext = await browser.newContext();
  await stubWhatsApp(customerContext);
  const customer = await customerContext.newPage();
  await customer.goto(`/r/${code}?to=${encodeURIComponent(PRODUCT)}`);
  await expect(customer).toHaveURL(new RegExp(`${PRODUCT}$`));
  const { number, whatsappMessage } = await orderNow(customer, `Customer ${run}`, `0321 ${String(Date.now()).slice(-7)}`);
  expect(whatsappMessage).toContain(`Order #${number}`);
  expect(whatsappMessage).toMatch(new RegExp(`Ref: ${code}$`));

  // The order is in Admin → Orders with the affiliate, and the affiliate sees it as Pending
  await admin.goto("/admin/orders");
  const order = admin.getByTestId("admin-order").filter({ hasText: number });
  await expect(order).toContainText(`Customer ${run}`);
  await expect(order).toContainText("Website");
  await expect(order).toContainText("Printed sides: Front & back");
  await expect(order.getByTestId("order-affiliate")).toHaveText("Hamza Tariq");
  await expect(order).toContainText(code);
  await expect(order.getByTestId("order-status")).toHaveText("Pending");

  await affiliate.goto("/affiliate/dashboard");
  await expect(affiliate.getByTestId("stat-Referred orders")).toHaveText("1");
  await expect(affiliate.getByTestId("commission-pending")).not.toHaveText("PKR 0");
  const pending = await affiliate.getByTestId("commission-pending").textContent();

  // Paid in full → commission Approved
  await order.getByLabel(`Status of ${number}`).selectOption("FULLY_PAID");
  await order.getByRole("button", { name: "Update" }).click();
  await expect(order.getByTestId("order-status")).toHaveText("Fully Paid");
  await affiliate.reload();
  await expect(affiliate.getByTestId("commission-pending")).toHaveText("PKR 0");
  await expect(affiliate.getByTestId("commission-approved")).toHaveText(pending!);
});
