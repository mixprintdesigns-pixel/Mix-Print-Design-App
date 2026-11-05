import { describe, expect, it } from "vitest";
import {
  billableSides,
  formatLength,
  formatRateTag,
  formatRs,
  formatSize,
  quoteRate,
  sideInInches,
  validateSize,
  type PricingRule,
  type SizeInput,
} from "@/lib/rates/calculator";
import { buttonName, lowestRate, publicGroup, publicSections, type RateItemRow, type RateSectionRow } from "@/lib/rates/visibility";

const ft = (w: [number, number], h: [number, number]): SizeInput => ({ unit: "ft-in", width: { value: w[0], inches: w[1] }, height: { value: h[0], inches: h[1] } });
const quote = (input: SizeInput, rule: PricingRule, rateMinor = 4500, designChargeMinor = 100_000) => {
  const r = quoteRate(input, { rule, rateMinor, designChargeMinor });
  if (!r.ok) throw new Error(r.error);
  return r.quote;
};

describe("Rule A: Flex, Backlit Flex and Sign Boards: each side to the next whole foot", () => {
  it.each<[string, SizeInput, string, number]>([
    ["6 ft 2 in × 3 ft", ft([6, 2], [3, 0]), "7 ft × 3 ft", 21],
    ["10 ft 3 in × 5 ft", ft([10, 3], [5, 0]), "11 ft × 5 ft", 55],
    ["4 ft × 3 ft", ft([4, 0], [3, 0]), "4 ft × 3 ft", 12],
  ])("%s → %s = %i sq ft", (typed, input, billable, sqft) => {
    for (const rule of ["FLEX", "SIGN_BOARD"] as const) {
      const q = quote(input, rule);
      expect(q.sizeText).toBe(typed);
      expect(q.billableText).toBe(billable);
      expect(q.sqft).toBe(sqft);
    }
  });

  it("rounds each side separately, never the area", () => {
    expect(quote(ft([3, 1], [4, 2]), "FLEX").sqft).toBe(20); // 4 × 5, not 3.08 × 4.17 ≈ 13
  });
});

describe("Rule B: Stickers on the 4.5 ft media roll", () => {
  it.each<[string, SizeInput, string, number]>([
    // 1. both ≤ 4.5 ft: smaller side up to a whole foot, larger exact
    ["3 ft 6 in × 4 ft 6 in", ft([3, 6], [4, 6]), "4 ft × 4.5 ft", 18],
    // 2. one ≤ 4.5 ft, the other longer: short side = 4.5 ft, long side exact, either way round
    ["3 ft × 6 ft", ft([3, 0], [6, 0]), "4.5 ft × 6 ft", 27],
    ["6 ft 6 in × 3 ft 4 in", ft([6, 6], [3, 4]), "6.5 ft × 4.5 ft", 29.25],
    // 3. both > 4.5 ft: width up to the next multiple of 4.5 ft, height exact
    ["14 ft × 6 ft", ft([14, 0], [6, 0]), "18 ft × 6 ft", 108],
    ["9 ft × 6 ft", ft([9, 0], [6, 0]), "9 ft × 6 ft", 54],
    ["9 ft 1 in × 6 ft 2 in", ft([9, 1], [6, 2]), "13.5 ft × 6 ft 2 in", 83.25],
  ])("%s → %s = %d sq ft", (typed, input, billable, sqft) => {
    const q = quote(input, "STICKER");
    expect(q.sizeText).toBe(typed);
    expect(q.billableText).toBe(billable);
    expect(q.sqft).toBeCloseTo(sqft, 10);
  });

  it("13.5 × 6.1667 is shown as 83.25 sq ft", () => {
    expect(quote(ft([9, 1], [6, 2]), "STICKER").sqftText).toBe("83.25");
  });

  it("case 2 works whichever side is the short one", () => {
    expect(quote(ft([6, 0], [3, 0]), "STICKER").sqft).toBe(27);
    expect(billableSides(36, 72, "STICKER")).toEqual({ width: 54, height: 72 });
    expect(billableSides(72, 36, "STICKER")).toEqual({ width: 72, height: 54 });
  });

  it("case 1 never charges more than the roll width for the smaller side", () => {
    // 4 ft 2 in × 4 ft 4 in: the smaller side would round to 5 ft, but the roll is 4.5 ft
    expect(quote(ft([4, 2], [4, 4]), "STICKER").billableText).toBe("4.5 ft × 4 ft 4 in");
  });

  it("exactly 4.5 ft counts as within the roll", () => {
    expect(quote(ft([4, 6], [8, 0]), "STICKER").sqft).toBe(36); // case 2: 4.5 × 8
  });
});

describe("unit conversions", () => {
  it("inches, cm and mm convert exactly", () => {
    expect(sideInInches({ value: 60 }, "in")).toBe(60);
    expect(sideInInches({ value: 2.54 }, "cm")).toBe(1);
    expect(sideInInches({ value: 25.4 }, "mm")).toBe(1);
    expect(sideInInches({ value: 10, inches: 3 }, "ft-in")).toBe(123);
  });

  it("the same size gives the same price in every unit", () => {
    const sizes: SizeInput[] = [
      ft([6, 2], [3, 0]),
      { unit: "in", width: { value: 74 }, height: { value: 36 } },
      { unit: "cm", width: { value: 187.96 }, height: { value: 91.44 } },
      { unit: "mm", width: { value: 1879.6 }, height: { value: 914.4 } },
    ];
    for (const rule of ["FLEX", "STICKER"] as const) {
      const totals = sizes.map((s) => quote(s, rule).totalMinor);
      expect(new Set(totals).size).toBe(1);
    }
  });

  it("exact sizes are not pushed up by rounding noise", () => {
    expect(quote({ unit: "cm", width: { value: 152.4 }, height: { value: 91.44 } }, "FLEX").sqft).toBe(15); // 5 × 3
    expect(quote({ unit: "mm", width: { value: 1371.6 }, height: { value: 1828.8 } }, "STICKER").sqft).toBe(27); // 4.5 × 6
  });

  it("shows the size exactly as typed", () => {
    expect(formatSize(ft([10, 3], [5, 0]))).toBe("10 ft 3 in × 5 ft");
    expect(formatSize(ft([0, 8], [2, 6]))).toBe("8 in × 2 ft 6 in");
    expect(formatSize({ unit: "cm", width: { value: 120 }, height: { value: 90.5 } })).toBe("120 cm × 90.5 cm");
    expect(formatSize({ unit: "in", width: { value: 48 }, height: { value: 24 } })).toBe("48 in × 24 in");
    expect(formatLength(54)).toBe("4.5 ft");
    expect(formatLength(74)).toBe("6 ft 2 in");
  });
});

describe("total: billable sq ft × rate + fixed designing charges, to the nearest rupee", () => {
  it("adds the designing charges", () => {
    const q = quote(ft([10, 3], [5, 0]), "FLEX", 4500, 100_000); // 55 × 45 = 2,475 + 1,000
    expect(q).toMatchObject({ rateMinor: 4500, designChargeMinor: 100_000, totalMinor: 347_500, printingMinor: 247_500 });
  });

  it("the designing charges are always added, whatever the size or rule", () => {
    for (const rule of ["FLEX", "STICKER", "SIGN_BOARD"] as const) {
      for (const input of [ft([1, 0], [1, 0]), ft([20, 0], [10, 0])]) {
        const q = quote(input, rule, 3000, 150_000);
        expect(q.totalMinor - q.printingMinor).toBe(150_000);
      }
    }
  });

  it("rounds the total to the nearest whole rupee", () => {
    // 83.25 sq ft × Rs 45.50 = Rs 3,787.875 + 1,000 = Rs 4,787.875 → Rs 4,788
    expect(quote(ft([9, 1], [6, 2]), "STICKER", 4550).totalMinor).toBe(478_800);
    // 29.25 × Rs 33 = Rs 965.25 + 1,000 → Rs 1,965
    expect(quote(ft([6, 6], [3, 4]), "STICKER", 3300).totalMinor).toBe(196_500);
    expect(quote(ft([6, 6], [3, 4]), "STICKER", 3300).totalMinor % 100).toBe(0);
  });

  it("asks for a rate and a valid size", () => {
    expect(quoteRate(ft([5, 0], [5, 0]), { rule: "FLEX", rateMinor: 0, designChargeMinor: 100_000 })).toEqual({ ok: false, error: "Choose a rate first." });
    expect(validateSize(ft([0, 0], [5, 0]))).toMatch(/width/);
    expect(validateSize(ft([5, -1], [5, 0]))).toMatch(/valid width/);
    expect(validateSize(ft([600, 0], [5, 0]))).toMatch(/too large/);
  });

  it("formats rupees and button rates", () => {
    expect(formatRs(347_500)).toBe("Rs 3,475");
    expect(formatRs(4550)).toBe("Rs 45.50");
    expect(formatRateTag(4500)).toBe("45/-");
  });
});

const item = (over: Partial<RateItemRow> = {}): RateItemRow => ({
  id: "i1",
  name: "Flex",
  subtitle: null,
  description: null,
  imageUrl: null,
  imageAlt: null,
  rateMinor: 0,
  isVisible: true,
  sortOrder: 0,
  featureIds: [],
  variants: [],
  ...over,
});
const v = (id: string, label: string, rateMinor: number, sortOrder = 0, isVisible = true) => ({ id, label, rateMinor, isVisible, sortOrder });

describe("what the website shows", () => {
  const flex: RateSectionRow = {
    id: "s1",
    title: "Flex GSM & Rate per sq ft (Rs)",
    kind: "FLEX",
    isVisible: true,
    sortOrder: 0,
    items: [
      item({ id: "gsm", variants: [v("a", "280 GSM", 5500, 2), v("b", "240 GSM", 4500, 1), v("c", "300 GSM", 0, 3), v("d", "320 GSM", 6500, 4, false)] }),
      item({ id: "famous", name: "Most Famous Flex Names", sortOrder: 1, variants: [v("e", "China Flex 240 GSM", 4500)] }),
      item({ id: "empty", name: "Empty row", sortOrder: 2, variants: [v("f", "400 GSM", 0)] }),
    ],
  };

  it("buttons in order; rate 0 or hidden buttons and empty rows are left out", () => {
    const [s] = publicSections([flex]);
    expect(s.groups.map((g) => [g.id, g.buttons.map((b) => b.label)])).toEqual([
      ["gsm", ["240 GSM", "280 GSM"]],
      ["famous", ["China Flex 240 GSM"]],
    ]);
    expect(lowestRate([s])).toBe(4500);
    expect(publicSections([{ ...flex, isVisible: false }])).toEqual([]);
  });

  it("order names: the first row adds its name, named rows use the button text", () => {
    const [s] = publicSections([flex]);
    expect(buttonName(s, s.groups[0], s.groups[0].buttons[0])).toBe("Flex 240 GSM");
    expect(buttonName(s, s.groups[1], s.groups[1].buttons[0])).toBe("China Flex 240 GSM");
  });

  it("sign board qualities: one rate button and the full features list with ticks", () => {
    const features = [
      { id: "f1", label: "Waterproof", isVisible: true, sortOrder: 0 },
      { id: "f2", label: "LED lights", isVisible: true, sortOrder: 1 },
      { id: "f3", label: "Hidden feature", isVisible: false, sortOrder: 2 },
    ];
    const g = publicGroup("SIGN_BOARD", item({ name: "Premium Backlit", subtitle: "Premium", rateMinor: 60000, featureIds: ["f2"] }), features)!;
    expect(g.buttons).toEqual([{ id: "i1", label: "Premium", rateMinor: 60000 }]);
    expect(g.features).toEqual([
      { label: "Waterproof", included: false },
      { label: "LED lights", included: true },
    ]);
    expect(publicGroup("SIGN_BOARD", item({ rateMinor: 0 }), features)).toBeNull();
  });
});

// ─── Nov 2026 additions ──────────────────────────────────────────────────────
import { parseBonusSlabs, rateCommission, ruleNote } from "@/lib/rates/calculator";
import { buttonRule, matchScore, preselectFor, publicSection, type PublicSection } from "@/lib/rates/visibility";

describe("3D Wallpaper: fitting charges", () => {
  it("Total = billable sq ft × (wallpaper rate + fitting rate) + designing charges", () => {
    // 10 ft 3 in × 8 ft → 11 × 8 = 88 sq ft × (Rs 120 + Rs 30) = 13,200 + 1,000
    const r = quoteRate(ft([10, 3], [8, 0]), { rule: "FLEX", rateMinor: 12_000, designChargeMinor: 100_000, fittingRateMinor: 3_000 });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote).toMatchObject({ sqft: 88, printingMinor: 1_056_000, fittingMinor: 264_000, fittingRateMinor: 3_000, designChargeMinor: 100_000, totalMinor: 1_420_000 });
  });

  it("without fitting, only the wallpaper and the designing charges", () => {
    const r = quoteRate(ft([10, 3], [8, 0]), { rule: "FLEX", rateMinor: 12_000, designChargeMinor: 100_000, fittingRateMinor: 0 });
    expect(r.ok && r.quote).toMatchObject({ fittingMinor: 0, totalMinor: 1_156_000 });
  });

  it("the lines always add up to the total, rounded to the rupee", () => {
    const r = quoteRate(ft([9, 1], [6, 2]), { rule: "STICKER", rateMinor: 4550, designChargeMinor: 100_000, fittingRateMinor: 1_525 });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote.printingMinor + r.quote.fittingMinor + r.quote.designChargeMinor).toBe(r.quote.totalMinor);
    expect(r.quote.totalMinor % 100).toBe(0);
  });
});

describe("affiliate commission per billable sq ft", () => {
  it("billable sq ft × commission per sq ft (the same sq ft as the calculator)", () => {
    const q = quote(ft([10, 3], [5, 0]), "FLEX"); // 55 sq ft
    expect(rateCommission(q.sqft, 500, [])).toMatchObject({ sqftMinor: 27_500, bonusMinor: 0, totalMinor: 27_500 }); // Flex Rs 5
    expect(rateCommission(quote(ft([9, 1], [6, 2]), "STICKER").sqft, 1000, []).totalMinor).toBe(83_250); // Stickers Rs 10 × 83.25
    expect(rateCommission(21, 5000, []).totalMinor).toBe(105_000); // Sign board Rs 50 × 21
  });

  it("adds the highest big-order bonus reached, once", () => {
    const slabs = parseBonusSlabs([{ minSqft: 1000, bonusMinor: 250_000 }, { minSqft: 500, bonusMinor: 100_000 }, { minSqft: "x" }]);
    expect(slabs).toEqual([{ minSqft: 500, bonusMinor: 100_000 }, { minSqft: 1000, bonusMinor: 250_000 }]);
    expect(rateCommission(499, 500, slabs)).toMatchObject({ bonusMinor: 0, totalMinor: 249_500 });
    expect(rateCommission(500, 500, slabs)).toMatchObject({ bonusMinor: 100_000, totalMinor: 350_000 });
    expect(rateCommission(1200, 500, slabs)).toMatchObject({ bonusMinor: 250_000, bonusSlab: { minSqft: 1000 } });
    expect(parseBonusSlabs("nonsense")).toEqual([]);
  });
});

const section = (over: Partial<PublicSection> = {}): PublicSection => ({ id: "s", title: "Flex", kind: "FLEX", groups: [], fittingRateMinor: null, askDesignCode: false, ...over });

describe("a button can use its own pricing rule (Reflective Flex → Sticker rule)", () => {
  const row = publicSection({
    id: "s",
    title: "Flex",
    kind: "FLEX",
    isVisible: true,
    sortOrder: 0,
    items: [item({ id: "famous", name: "Most Famous Flex Names", variants: [{ ...v("r", "Reflective Flex 400 GSM", 9000), rule: "STICKER" }, v("c", "China Flex 240 GSM", 4500)] })],
  })!;
  it("the button's rule, otherwise the section's", () => {
    const [reflective, china] = row.groups[0].buttons;
    expect(buttonRule(row, reflective)).toBe("STICKER");
    expect(buttonRule(row, china)).toBe("FLEX");
    // 3 ft × 6 ft: Sticker rule 4.5 × 6 = 27 sq ft, Flex rule 3 × 6 = 18 sq ft
    expect(quote(ft([3, 0], [6, 0]), buttonRule(row, reflective)).sqft).toBe(27);
    expect(quote(ft([3, 0], [6, 0]), buttonRule(row, china)).sqft).toBe(18);
    expect(ruleNote("STICKER")).toMatch(/4.5 ft/);
    expect(ruleNote("FLEX")).toMatch(/next full foot/);
  });
});

describe("pre-selecting the button of a page", () => {
  const flex = section({
    groups: [
      { id: "gsm", name: "Flex", subtitle: null, description: null, imageUrl: null, imageAlt: null, features: [], buttons: [{ id: "g240", label: "240 GSM", rateMinor: 4500 }] },
      {
        id: "famous",
        name: "Most Famous Flex Names",
        subtitle: null,
        description: null,
        imageUrl: null,
        imageAlt: null,
        features: [],
        buttons: [
          { id: "china", label: "China Flex 240 GSM", rateMinor: 4500 },
          { id: "hd", label: "HD Star Flex 280 GSM", rateMinor: 5500 },
          { id: "star", label: "Star Flex 320 GSM", rateMinor: 6500 },
          { id: "korean", label: "Korean Star 400 GSM", rateMinor: 8500 },
        ],
      },
    ],
  });
  it.each([
    ["China Flex", "china"],
    ["HD Star Flex", "hd"],
    ["Star Flex", "star"],
    ["Korean Star Flex", "korean"],
  ])("%s → %s", (page, button) => {
    expect(preselectFor(flex, page)?.buttonId).toBe(button);
  });

  it("nothing is pre-selected when no button clearly matches", () => {
    expect(preselectFor(flex, "Panaflex")).toBeNull();
    expect(preselectFor(flex, "Flex Printing")).toBeNull();
  });

  it("sign board child pages pick their quality", () => {
    const boards = section({
      kind: "SIGN_BOARD",
      groups: ["Normal", "Medium", "Premium"].map((q, i) => ({
        id: q,
        name: `${["Economy", "Standard", "Premium"][i]} Backlit Sign Board`,
        subtitle: q,
        description: null,
        imageUrl: null,
        imageAlt: null,
        features: [],
        buttons: [{ id: q, label: q, rateMinor: 35000 + i * 10000 }],
      })),
    });
    expect(preselectFor(boards, "Normal Backlit Sign Board")?.groupId).toBe("Normal");
    expect(preselectFor(boards, "Medium Backlit Sign Board")?.groupId).toBe("Medium");
    expect(preselectFor(boards, "Premium Backlit Sign Board")?.groupId).toBe("Premium");
    expect(matchScore("Simple Acrylic Sign", "Normal", "Economy 3D Sign Board")).toBeLessThan(3);
  });
});
