import { describe, expect, it } from "vitest";
import { calculateCommission, normalizeCode, safeLandingPath } from "@/lib/affiliate/commission";
import { normalizeIban, payoutDetailsSchema } from "@/lib/affiliate/validation";

const item = (lineTotalMinor: number, productRateBps: number | null = null) => ({
  productId: "p",
  productName: "Cards",
  lineTotalMinor,
  productRateBps,
});

describe("calculateCommission", () => {
  it("uses product rate, then affiliate rate, then the program default", () => {
    const result = calculateCommission([item(100_000, 1000), item(100_000)], { affiliateRateBps: 700, defaultRateBps: 500 });
    expect(result.breakdown.map((b) => [b.rateBps, b.commissionMinor])).toEqual([
      [1000, 10_000],
      [700, 7_000],
    ]);
    expect(result).toMatchObject({ baseAmountMinor: 200_000, amountMinor: 17_000 });
    expect(calculateCommission([item(100_000)], { affiliateRateBps: null, defaultRateBps: 500 }).amountMinor).toBe(5_000);
  });

  it("shares order discounts across items in proportion", () => {
    const result = calculateCommission([item(30_000), item(10_000)], { affiliateRateBps: null, defaultRateBps: 1000 }, 4_000);
    expect(result.breakdown.map((b) => b.baseMinor)).toEqual([27_000, 9_000]);
    expect(result.amountMinor).toBe(3_600);
  });

  it("never goes negative and rounds down to the paisa", () => {
    expect(calculateCommission([item(1_000)], { affiliateRateBps: null, defaultRateBps: 500 }, 5_000).amountMinor).toBe(0);
    expect(calculateCommission([item(333)], { affiliateRateBps: null, defaultRateBps: 500 }).amountMinor).toBe(16);
    expect(calculateCommission([], { affiliateRateBps: null, defaultRateBps: 500 }).amountMinor).toBe(0);
  });
});

describe("referral helpers", () => {
  it("normalizes codes", () => {
    expect(normalizeCode(" ayesha7k2q ")).toBe("AYESHA7K2Q");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("abc-123")).toBeNull();
  });
  it("only allows local landing paths", () => {
    expect(safeLandingPath("/products/flyers")).toBe("/products/flyers");
    for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/r/LOOP1234"]) {
      expect(safeLandingPath(bad)).toBe("/");
    }
  });
});

describe("payout details", () => {
  it("normalizes wallets and IBANs", () => {
    expect(payoutDetailsSchema.parse({ payoutMethod: "JAZZCASH", payoutAccount: "0300-1234567", payoutAccountName: "Ali" }).payoutAccount).toBe(
      "+923001234567",
    );
    expect(normalizeIban("pk36 scbl 0000 0011 2345 6702")).toBe("PK36SCBL0000001123456702");
    expect(payoutDetailsSchema.safeParse({ payoutMethod: "BANK_TRANSFER", payoutAccount: "0300 1234567", payoutAccountName: "Ali" }).success).toBe(
      false,
    );
    expect(payoutDetailsSchema.safeParse({ payoutMethod: "EASYPAISA", payoutAccount: "12345", payoutAccountName: "Ali" }).success).toBe(false);
  });
});

describe("fixed Rs commission per product", () => {
  it("pays the fixed amount per order of the product, whatever the quantity, capped at the line total", async () => {
    const { calculateCommission, fixedCommissionPercentBps } = await import("@/lib/affiliate/commission");
    const result = calculateCommission(
      [
        { productId: "a", productName: "Sign board", lineTotalMinor: 500_000, productRateBps: 1000, productFixedMinor: 20_000 },
        { productId: "b", productName: "Cards", lineTotalMinor: 100_000, productRateBps: null },
        { productId: "c", productName: "Sticker", lineTotalMinor: 5_000, productRateBps: null, productFixedMinor: 20_000 },
      ],
      { affiliateRateBps: null, defaultRateBps: 500 },
    );
    expect(result.breakdown.map((b) => b.commissionMinor)).toEqual([20_000, 5_000, 5_000]);
    expect(result.breakdown[0]).toMatchObject({ fixedMinor: 20_000, rateBps: 400 }); // Rs 200 on Rs 5,000 = 4%
    expect(fixedCommissionPercentBps(20_000, 500_000)).toBe(400);
    expect(fixedCommissionPercentBps(20_000, 0)).toBeNull();
  });
});
