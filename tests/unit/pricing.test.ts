import { describe, expect, it } from "vitest";
import {
  bulkDiscountBps,
  configKey,
  formatPercent,
  linePrice,
  resolveSelection,
  tierUnitPrice,
  validateQuantity,
  type OptionInput,
} from "@/lib/pricing";

const options: OptionInput[] = [
  { id: "paper", name: "Paper", values: [{ id: "matte", label: "Matte", priceDeltaMinor: 0 }, { id: "gloss", label: "Gloss", priceDeltaMinor: 50 }] },
  { id: "sides", name: "Sides", values: [{ id: "single", label: "Single", priceDeltaMinor: 0 }, { id: "double", label: "Double", priceDeltaMinor: 100 }] },
];
const tiers = [
  { minQuantity: 1000, unitPriceMinor: 200 },
  { minQuantity: 500, unitPriceMinor: 250 },
];

describe("tierUnitPrice", () => {
  it("uses the base price below the first tier", () => {
    expect(tierUnitPrice(300, tiers, 100)).toBe(300);
  });
  it("uses the highest tier reached, regardless of tier order", () => {
    expect(tierUnitPrice(300, tiers, 500)).toBe(250);
    expect(tierUnitPrice(300, tiers, 999)).toBe(250);
    expect(tierUnitPrice(300, tiers, 5000)).toBe(200);
  });
});

describe("validateQuantity", () => {
  const product = { minQuantity: 100, quantityStep: 50 };
  it("accepts valid quantities", () => {
    expect(validateQuantity(product, 100)).toBeNull();
    expect(validateQuantity(product, 150)).toBeNull();
  });
  it("rejects below minimum, off-step, fractional and huge quantities", () => {
    expect(validateQuantity(product, 50)).toMatch(/Minimum/);
    expect(validateQuantity(product, 120)).toMatch(/steps of 50/);
    expect(validateQuantity(product, 100.5)).toMatch(/whole number/);
    expect(validateQuantity(product, Number.NaN)).toMatch(/whole number/);
    expect(validateQuantity(product, 1_000_000)).toMatch(/custom quote/);
  });
});

describe("resolveSelection", () => {
  it("returns the selection in option order", () => {
    const result = resolveSelection(options, ["double", "gloss"]);
    expect(result).toEqual({
      ok: true,
      selection: [
        { optionId: "paper", option: "Paper", valueId: "gloss", value: "Gloss", priceDeltaMinor: 50, pricing: "PER_UNIT" },
        { optionId: "sides", option: "Sides", valueId: "double", value: "Double", priceDeltaMinor: 100, pricing: "PER_UNIT" },
      ],
    });
  });
  it("requires exactly one value per option", () => {
    expect(resolveSelection(options, ["gloss"])).toEqual({ ok: false, error: "Please choose one Sides." });
    expect(resolveSelection(options, ["gloss", "matte", "single"])).toMatchObject({ ok: false });
  });
  it("rejects unknown and duplicate ids", () => {
    expect(resolveSelection(options, ["gloss", "single", "hacked"])).toEqual({ ok: false, error: "Unknown option selected." });
    expect(resolveSelection(options, ["gloss", "gloss", "single"])).toEqual({ ok: false, error: "Duplicate option selected." });
  });
});

describe("linePrice", () => {
  it("adds option deltas to the tier price", () => {
    const selection = resolveSelection(options, ["gloss", "double"]);
    if (!selection.ok) throw new Error("expected ok");
    expect(linePrice({ basePriceMinor: 300, priceTiers: tiers }, selection.selection, 500)).toEqual({
      unitPriceMinor: 250 + 50 + 100,
      flatFeesMinor: 0,
      discountBps: 0,
      discountMinor: 0,
      lineTotalMinor: 400 * 500,
    });
  });

  it("charges per-order options once and applies bulk discounts to units only", () => {
    const withDie: OptionInput[] = [
      ...options,
      {
        id: "cut",
        name: "Cutting",
        values: [
          { id: "std", label: "Standard", priceDeltaMinor: 0 },
          { id: "die", label: "Custom die", priceDeltaMinor: 150_000, pricing: "PER_ORDER" },
        ],
      },
    ];
    const selection = resolveSelection(withDie, ["matte", "single", "die"]);
    if (!selection.ok) throw new Error("expected ok");
    const product = { basePriceMinor: 300, priceTiers: tiers, bulkDiscounts: [{ minQuantity: 1000, percentBps: 1000 }] };

    // 999 units: no discount. 300 × 999 = 299,700 + 150,000 die
    expect(linePrice(product, selection.selection, 999)).toMatchObject({
      unitPriceMinor: 250,
      flatFeesMinor: 150_000,
      discountMinor: 0,
      lineTotalMinor: 250 * 999 + 150_000,
    });
    // 1000 units: tier 200, 10% off units only
    expect(linePrice(product, selection.selection, 1000)).toEqual({
      unitPriceMinor: 200,
      flatFeesMinor: 150_000,
      discountBps: 1000,
      discountMinor: 20_000,
      lineTotalMinor: 200_000 - 20_000 + 150_000,
    });
  });
});

describe("bulkDiscountBps", () => {
  const discounts = [
    { minQuantity: 5000, percentBps: 1000 },
    { minQuantity: 2000, percentBps: 500 },
  ];
  it("uses the highest threshold reached", () => {
    expect(bulkDiscountBps(discounts, 1999)).toBe(0);
    expect(bulkDiscountBps(discounts, 2000)).toBe(500);
    expect(bulkDiscountBps(discounts, 9000)).toBe(1000);
    expect(bulkDiscountBps(undefined, 9000)).toBe(0);
  });
  it("formats percentages", () => {
    expect(formatPercent(500)).toBe("5%");
    expect(formatPercent(250)).toBe("2.5%");
  });
});

describe("configKey", () => {
  it("is independent of selection order", () => {
    expect(configKey(["b", "a"])).toBe(configKey(["a", "b"]));
  });
});
