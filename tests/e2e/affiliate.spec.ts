import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://mixprint:mixprint_dev@127.0.0.1:5432/mixprint_e2e";

async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Mobile number/).fill("0321 7654321");
  await page.getByLabel("Password").fill("MixPrint2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mixprint.local");
  await page.getByLabel("Password").fill("ChangeMe12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return page;
}

function simulateReferredOrder(buyerEmail: string, code: string, amountPaisa: number): { commission: number | null } {
  const out = execFileSync(
    "npx",
    ["tsx", "--conditions=react-server", "tests/e2e/support/simulate-referred-order.ts", buyerEmail, code, String(amountPaisa)],
    { env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL }, encoding: "utf8" },
  );
  return JSON.parse(out.trim().split("\n").at(-1)!);
}

test("home page promotes the affiliate program", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: /Earn .* on every order/ });
  await expect(section).toBeVisible();
  await section.getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("commission");
  await expect(page.getByRole("link", { name: "Earn with us" })).toBeVisible();
});

test.describe("affiliate journey", () => {
  test.skip(({ isMobile }) => isMobile, "Covered on desktop");

  test("apply, get approved, refer a sale, withdraw and get paid", async ({ page, browser }) => {
    const run = Date.now().toString(36);
    const affiliateEmail = `affiliate-${run}@example.com`;
    const buyerEmail = `buyer-${run}@example.com`;

    // 1. Apply
    await register(page, "Sana Malik", affiliateEmail);
    await page.goto("/affiliate");
    await page.getByRole("link", { name: "Join for free" }).first().click();
    await expect(page).toHaveURL(/\/affiliate\/join$/);
    await expect(page.getByLabel("Wallet mobile number")).toHaveValue("03217654321");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Tell us briefly how you will promote")).toBeVisible();
    await expect(page.getByText("You must accept the affiliate terms.")).toBeVisible();
    await page.getByLabel("How will you promote MixPrint?").fill("I run a Lahore small-business WhatsApp group.");
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page).toHaveURL(/\/affiliate\/dashboard\?joined=1$/);
    await expect(page.getByTestId("affiliate-status")).toContainText("under review");
    await expect(page.getByTestId("referral-link")).toHaveCount(0);

    // 2. Admin approves
    const admin = await adminPage(browser);
    await admin.goto(`/admin/affiliates?q=${encodeURIComponent(affiliateEmail)}`);
    const row = admin.getByTestId("affiliate-row").filter({ hasText: affiliateEmail });
    await expect(row).toContainText("pending");
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row.getByRole("status")).toHaveText("Affiliate approved.");

    // 3. Affiliate gets links
    await page.goto("/affiliate/dashboard");
    const link = await page.getByTestId("referral-link").inputValue();
    expect(link).toMatch(/\/r\/SANAMA[A-Z2-9]{4}$/);
    const code = link.split("/r/")[1];
    await page.getByLabel("Link to a specific product").selectOption({ label: "A5 Flyers" });
    await expect(page.getByTestId("product-link")).toHaveValue(`${link}?to=%2Fproducts%2Fa5-flyers`);

    // 4. A visitor clicks the product link and later registers
    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    await visitor.goto(new URL(await page.getByTestId("product-link").inputValue()).pathname + "?to=%2Fproducts%2Fa5-flyers");
    await expect(visitor).toHaveURL(/\/products\/a5-flyers$/);
    const ref = (await visitorContext.cookies()).find((c) => c.name === "mp_ref");
    expect(ref).toMatchObject({ value: code, httpOnly: true });
    await register(visitor, "Bilal Ahmed", buyerEmail);

    await page.reload();
    await expect(page.getByTestId("stat-Clicks (30 days)")).toHaveText("1");

    // 5. The visitor's order is delivered (checkout stand-in): PKR 30,000 × 5% = PKR 1,500
    expect(simulateReferredOrder(buyerEmail, code, 3_000_000).commission).toBe(150_000);
    // An affiliate's own order earns nothing
    expect(simulateReferredOrder(affiliateEmail, code, 3_000_000).commission).toBeNull();

    await page.reload();
    await expect(page.getByTestId("stat-Referred orders")).toHaveText("1");
    await expect(page.getByTestId("available-balance")).toHaveText("PKR 1,500");

    // 6. Withdraw
    await page.getByRole("button", { name: "Withdraw available balance" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Withdrawal requested" })).toBeVisible();
    await expect(page.getByTestId("available-balance")).toHaveText("PKR 0");
    await expect(page.getByTestId("withdrawals")).toContainText("requested");

    // 7. Admin pays
    await admin.goto("/admin/affiliates/withdrawals?status=REQUESTED");
    const withdrawal = admin.getByTestId("withdrawal-row").filter({ hasText: affiliateEmail });
    await expect(withdrawal).toContainText("PKR 1,500");
    await expect(withdrawal).toContainText("+923217654321");
    admin.once("dialog", (d) => d.accept());
    await withdrawal.getByLabel("Transaction reference").fill(`JC-${run}`);
    await withdrawal.getByRole("button", { name: "Mark as paid" }).click();
    // Paid requests leave the "requested" list and appear under "paid" with the reference.
    await expect(withdrawal).toHaveCount(0);
    await admin.goto("/admin/affiliates/withdrawals?status=PAID");
    await expect(admin.getByTestId("withdrawal-row").filter({ hasText: affiliateEmail })).toContainText(`ref JC-${run}`);

    await page.reload();
    await expect(page.getByTestId("withdrawals")).toContainText("paid");
    await expect(page.getByTestId("withdrawals")).toContainText(`Ref JC-${run}`);
    await expect(page.getByTestId("stat-Total earned")).toHaveText("PKR 1,500");
  });

  test("unknown referral codes and unsafe redirects are ignored", async ({ page, context }) => {
    await page.goto("/r/NOSUCHCODE?to=https://evil.example.com");
    await expect(page).toHaveURL(/localhost:3100\/$/);
    expect((await context.cookies()).find((c) => c.name === "mp_ref")).toBeUndefined();
  });

  test("customers cannot open affiliate admin", async ({ page }) => {
    await register(page, "Nosy Customer", `nosy-${Date.now()}@example.com`);
    await page.goto("/admin/affiliates/withdrawals");
    await expect(page).toHaveURL(/\/$/);
  });
});
