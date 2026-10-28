import { describe, expect, it } from "vitest";
import { configKey, linePrice, resolveSelection, tierUnitPrice, validateQuantity, type OptionInput } from "@/lib/pricing";

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
        { optionId: "paper", option: "Paper", valueId: "gloss", value: "Gloss", priceDeltaMinor: 50 },
        { optionId: "sides", option: "Sides", valueId: "double", value: "Double", priceDeltaMinor: 100 },
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
      lineTotalMinor: 400 * 500,
    });
  });
});

describe("configKey", () => {
  it("is independent of selection order", () => {
    expect(configKey(["b", "a"])).toBe(configKey(["a", "b"]));
  });
});
