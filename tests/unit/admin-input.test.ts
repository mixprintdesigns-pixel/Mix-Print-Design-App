import { describe, expect, it } from "vitest";
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/storage/images";
import { issuesToErrors, parsePercent, parseRupees, productInputSchema } from "@/lib/admin/product-input";
import { validProduct } from "../support/fixtures";
import { isBootstrapAdmin } from "@/lib/auth/service";


describe("parseRupees", () => {
  it.each([
    ["1250", 125000],
    ["1,250.5", 125050],
    ["2.50", 250],
    ["0", 0],
    [3, 300],
  ])("%s → %d paisa", (input, expected) => expect(parseRupees(input)).toBe(expected));
  it.each(["", "-5", "1.234", "abc", "1e5", "12345678901"])("rejects %s", (input) => expect(parseRupees(input)).toBeNull());
});

describe("parsePercent", () => {
  it("converts to basis points", () => {
    expect(parsePercent("5")).toBe(500);
    expect(parsePercent("12.5")).toBe(1250);
    expect(parsePercent("100")).toBe(10000);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("productInputSchema", () => {
  it("normalises and converts a valid product", () => {
    const data = productInputSchema.parse(validProduct);
    expect(data).toMatchObject({
      sku: "BC-STD-001",
      basePrice: 350,
      summary: null,
      seoTitle: null,
      affiliateCommission: 750,
      priceTiers: [{ minQuantity: 500, unitPrice: 275 }],
      bulkDiscounts: [{ minQuantity: 2000, percent: 500 }],
    });
    expect(data.options[0].values[1]).toEqual({ label: "Spot UV plate", priceDelta: 150000, pricing: "PER_ORDER" });
  });

  it("reports field errors by path", () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      slug: "Bad Slug!",
      basePrice: "free",
      options: [{ name: "Size", kind: "SIZE", values: [] }],
    });
    expect(result.success).toBe(false);
    expect(Object.keys(issuesToErrors(result.error!)).sort()).toEqual(["basePrice", "options.0.values", "slug"]);
  });

  it("reports duplicates once the fields are valid", () => {
    const value = (label: string) => ({ label, priceDelta: "0", pricing: "PER_UNIT" as const });
    const result = productInputSchema.safeParse({
      ...validProduct,
      priceTiers: [
        { minQuantity: 500, unitPrice: "2" },
        { minQuantity: 500, unitPrice: "1" },
      ],
      bulkDiscounts: [
        { minQuantity: 1000, percent: "5" },
        { minQuantity: 1000, percent: "10" },
      ],
      options: [
        { name: "Size", kind: "SIZE", values: [value("A4")] },
        { name: "size", kind: "SIZE", values: [value("A4"), value("a4")] },
      ],
    });
    expect(Object.keys(issuesToErrors(result.error!)).sort()).toEqual([
      "bulkDiscounts.1.minQuantity",
      "options.1.name",
      "options.1.values.1.label",
      "priceTiers.1.minQuantity",
    ]);
  });
});

describe("checkImage", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  it("detects types from file contents", () => {
    expect(checkImage(png)).toMatchObject({ ok: true, type: "image/png" });
    expect(checkImage(jpg)).toMatchObject({ ok: true, type: "image/jpeg" });
    expect(checkImage(webp)).toMatchObject({ ok: true, type: "image/webp" });
  });
  it("rejects SVG, other files, empty and oversized files", () => {
    expect(checkImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toMatchObject({ ok: false });
    expect(checkImage(new TextEncoder().encode("%PDF-1.7"))).toMatchObject({ ok: false });
    expect(checkImage(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    expect(checkImage(big)).toEqual({ ok: false, error: "Images must be 4 MB or smaller." });
  });
});

describe("isBootstrapAdmin", () => {
  it("matches configured emails case-insensitively", () => {
    expect(isBootstrapAdmin("Owner@MixPrint.pk", " owner@mixprint.pk , other@x.com")).toBe(true);
    expect(isBootstrapAdmin("someone@x.com", "owner@mixprint.pk")).toBe(false);
    expect(isBootstrapAdmin("owner@mixprint.pk", undefined)).toBe(false);
  });
});
