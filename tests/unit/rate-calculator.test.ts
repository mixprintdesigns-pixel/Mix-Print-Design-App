import { describe, expect, it } from "vitest";
import { billableFeet, formatRs, formatSize, quoteRate, sideInInches, validateSize, type SizeInput } from "@/lib/rates/calculator";
import { groupBySection, lowestRate, publicItem, publicItems, rateFor, type RateItemRow } from "@/lib/rates/visibility";

const ftIn = (wFt: number, wIn: number, hFt: number, hIn: number, quantity = 1): SizeInput => ({
  unit: "ft-in",
  width: { value: wFt, inches: wIn },
  height: { value: hFt, inches: hIn },
  quantity,
});
const pricing = { rateMinor: 4500, designChargeMinor: 100_000 }; // Rs 45 per sq ft, Rs 1,000 design

describe("billing rule: each side rounded UP to the next whole foot", () => {
  it.each([
    [3, 1, 4],
    [4, 2, 5],
    [10, 3, 11],
    [5, 0, 5],
    [0, 1, 1],
    [11, 11.5, 12],
    [12, 0, 12],
  ])("%i ft %i in → %i ft", (ft, inch, expected) => {
    expect(billableFeet(sideInInches({ value: ft, inches: inch }, "ft-in"))).toBe(expected);
  });

  it("10 ft 3 in × 5 ft = 11 × 5 = 55 sq ft", () => {
    const r = quoteRate(ftIn(10, 3, 5, 0), pricing);
    expect(r.ok && r.quote).toMatchObject({ sizeText: "10 ft 3 in × 5 ft", widthFt: 11, heightFt: 5, sqft: 55 });
  });

  it("rounds each side separately, never the area", () => {
    // 3 ft 1 in × 4 ft 2 in: 4 × 5 = 20 sq ft (not 3.08 × 4.17 = 12.8 → 13)
    const r = quoteRate(ftIn(3, 1, 4, 2), pricing);
    expect(r.ok && r.quote.sqft).toBe(20);
  });

  it("multiplies by the quantity after rounding", () => {
    const r = quoteRate(ftIn(10, 3, 5, 0, 3), pricing);
    expect(r.ok && r.quote.sqft).toBe(165);
  });
});

describe("unit conversions", () => {
  it("inches, cm, mm and meters convert exactly", () => {
    expect(sideInInches({ value: 60 }, "in")).toBe(60);
    expect(sideInInches({ value: 2.54 }, "cm")).toBeCloseTo(1);
    expect(sideInInches({ value: 25.4 }, "mm")).toBeCloseTo(1);
    expect(sideInInches({ value: 1 }, "m")).toBeCloseTo(39.37, 2);
    expect(sideInInches({ value: 10, inches: 3 }, "ft-in")).toBe(123);
  });

  it("exact sizes in other units are not pushed up by rounding noise", () => {
    expect(billableFeet(sideInInches({ value: 152.4 }, "cm"))).toBe(5); // exactly 5 ft
    expect(billableFeet(sideInInches({ value: 1524 }, "mm"))).toBe(5);
    expect(billableFeet(sideInInches({ value: 3.048 }, "m"))).toBe(10);
    expect(billableFeet(sideInInches({ value: 60 }, "in"))).toBe(5);
    expect(billableFeet(sideInInches({ value: 61 }, "in"))).toBe(6);
  });

  it("1 m × 50 cm: 3.28 ft → 4 ft, 1.64 ft → 2 ft = 8 sq ft", () => {
    const r = quoteRate({ unit: "m", width: { value: 1 }, height: { value: 0.5 }, quantity: 1 }, pricing);
    expect(r.ok && r.quote).toMatchObject({ widthFt: 4, heightFt: 2, sqft: 8 });
    const cm = quoteRate({ unit: "cm", width: { value: 100 }, height: { value: 50 }, quantity: 1 }, pricing);
    expect(cm.ok && cm.quote.sqft).toBe(8);
  });

  it("shows the size exactly as typed", () => {
    expect(formatSize(ftIn(10, 3, 5, 0))).toBe("10 ft 3 in × 5 ft");
    expect(formatSize(ftIn(0, 8, 2, 6))).toBe("8 in × 2 ft 6 in");
    expect(formatSize({ unit: "cm", width: { value: 120 }, height: { value: 90.5 } })).toBe("120 cm × 90.5 cm");
    expect(formatSize({ unit: "m", width: { value: 3 }, height: { value: 1.5 } })).toBe("3 m × 1.5 m");
    expect(formatSize({ unit: "in", width: { value: 48 }, height: { value: 24 } })).toBe("48 in × 24 in");
  });
});

describe("price breakdown and the fixed design charge", () => {
  it("printing = billable sq ft × rate; total adds the design charge", () => {
    const r = quoteRate(ftIn(10, 3, 5, 0), pricing);
    expect(r.ok && r.quote).toMatchObject({ rateMinor: 4500, printingMinor: 55 * 4500, designChargeMinor: 100_000, totalMinor: 55 * 4500 + 100_000, minimumApplied: false });
  });

  it("the design charge is always added, whatever the size", () => {
    for (const input of [ftIn(1, 0, 1, 0), ftIn(20, 0, 10, 0, 4)]) {
      const r = quoteRate(input, { rateMinor: 3000, designChargeMinor: 150_000 });
      expect(r.ok && r.quote.totalMinor - r.quote.printingMinor).toBe(150_000);
    }
  });

  it("a minimum order amount raises small printing costs", () => {
    const r = quoteRate(ftIn(2, 0, 2, 0), { ...pricing, minOrderMinor: 500_000 });
    expect(r.ok && r.quote).toMatchObject({ areaCostMinor: 4 * 4500, printingMinor: 500_000, minimumApplied: true, totalMinor: 600_000 });
    const big = quoteRate(ftIn(20, 0, 10, 0), { ...pricing, minOrderMinor: 500_000 });
    expect(big.ok && big.quote.minimumApplied).toBe(false);
  });

  it("rejects missing, negative or huge sizes, bad quantities, and items without a rate", () => {
    expect(validateSize(ftIn(0, 0, 5, 0))).toMatch(/width/);
    expect(validateSize(ftIn(5, -1, 5, 0))).toMatch(/valid width/);
    expect(validateSize(ftIn(600, 0, 5, 0))).toMatch(/too large/);
    expect(validateSize(ftIn(5, 0, 5, 0, 0))).toMatch(/Quantity/);
    expect(validateSize(ftIn(5, 0, 5, 0, 1.5))).toMatch(/Quantity/);
    expect(quoteRate(ftIn(5, 0, 5, 0), { rateMinor: 0, designChargeMinor: 100_000 }).ok).toBe(false);
  });

  it("formats rupees for the page", () => {
    expect(formatRs(4500)).toBe("Rs 45");
    expect(formatRs(4550)).toBe("Rs 45.50");
    expect(formatRs(1_247_500)).toBe("Rs 12,475");
  });
});

const item = (over: Partial<RateItemRow> = {}): RateItemRow => ({
  id: "i1",
  section: null,
  name: "China Flex",
  subtitle: null,
  description: null,
  imageUrl: null,
  imageAlt: null,
  rateMinor: 0,
  variantType: "NONE",
  isVisible: true,
  sortOrder: 0,
  variants: [],
  ...over,
});

describe("variant rates and what the website shows", () => {
  const flex = item({
    variantType: "GSM",
    variants: [
      { id: "g280", label: "280 GSM", rateMinor: 0, isVisible: true, sortOrder: 5 },
      { id: "g240", label: "240 GSM", rateMinor: 3500, isVisible: true, sortOrder: 3 },
      { id: "g300", label: "300 GSM", rateMinor: 4200, isVisible: false, sortOrder: 6 },
      { id: "g200", label: "200 GSM", rateMinor: 2800, isVisible: true, sortOrder: 1 },
    ],
  });

  it("hides variants with rate 0 or switched off, in order", () => {
    expect(publicItem(flex)?.variants.map((v) => v.label)).toEqual(["200 GSM", "240 GSM"]);
  });

  it("uses the selected variant's rate", () => {
    const shown = publicItem(flex)!;
    expect(rateFor(shown, "g240")?.rateMinor).toBe(3500);
    expect(rateFor(shown, "g200")?.rateMinor).toBe(2800);
    expect(rateFor(shown, "g300")).toBeNull(); // hidden
    expect(rateFor(shown, "g280")).toBeNull(); // rate 0
    expect(lowestRate(shown)).toBe(2800);
  });

  it("hides items with rate 0, hidden items, and items whose variants all have rate 0", () => {
    expect(publicItem(item({ rateMinor: 0 }))).toBeNull();
    expect(publicItem(item({ rateMinor: 5000, isVisible: false }))).toBeNull();
    expect(publicItem(item({ variantType: "SERIES", variants: [{ id: "s1", label: "1000 series", rateMinor: 0, isVisible: true, sortOrder: 0 }] }))).toBeNull();
    const single = publicItem(item({ rateMinor: 5000 }))!;
    expect(rateFor(single, undefined)?.rateMinor).toBe(5000);
    expect(publicItems([item({ id: "b", sortOrder: 2, rateMinor: 1 }), item({ id: "a", sortOrder: 1, rateMinor: 1 }), item({ id: "z" })]).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("groups items into sections in the order they appear", () => {
    const groups = groupBySection([{ section: "Flex", n: 1 }, { section: "Stickers", n: 2 }, { section: "Flex", n: 3 }, { section: null, n: 4 }]);
    expect(groups.map((g) => [g.section, g.items.map((i) => i.n)])).toEqual([
      ["Flex", [1, 3]],
      ["Stickers", [2]],
      ["", [4]],
    ]);
  });
});
