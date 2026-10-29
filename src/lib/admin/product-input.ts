// Validation for the admin product and category editors. Shared by the browser (to show
// errors early) and the server (the source of truth). Money is typed in rupees and stored in paisa.
import { z } from "zod";

/** "1,250.50" → 125050 paisa. Returns null for anything that is not a valid amount. */
export function parseRupees(input: string | number): number | null {
  const text = String(input).replace(/,/g, "").trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 125050 → "1250.5" for editing. */
export function paisaToRupeesInput(minor: number): string {
  return String(minor / 100);
}

/** "12.5" (%) → 1250 basis points. */
export function parsePercent(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const bps = Math.round(Number(text) * 100);
  return bps <= 10_000 ? bps : null;
}

const rupees = (label: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const minor = parseRupees(v);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: `${label}: enter an amount in rupees, e.g. 1250 or 2.50.` });
      return z.NEVER;
    }
    return minor;
  });

const percent = (label: string, { min, max }: { min: number; max: number }) =>
  z.string().transform((v, ctx) => {
    const bps = parsePercent(v);
    if (bps === null || bps < min || bps > max) {
      ctx.addIssue({ code: "custom", message: `${label}: enter a percentage between ${min / 100} and ${max / 100}.` });
      return z.NEVER;
    }
    return bps;
  });

const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be at most ${max}.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .transform((v) => v || null);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens, e.g. business-cards.");

export const OPTION_KINDS = ["SIZE", "MATERIAL", "FINISHING", "OTHER"] as const;
export const OPTION_PRICING = ["PER_UNIT", "PER_ORDER"] as const;
export const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const optionValueSchema = z.object({
  id: z.string().max(50).optional(),
  label: z.string().trim().min(1, "Enter a value label.").max(80),
  priceDelta: rupees("Surcharge"),
  pricing: z.enum(OPTION_PRICING),
});

const optionSchema = z.object({
  id: z.string().max(50).optional(),
  name: z.string().trim().min(1, "Enter an option name.").max(50),
  kind: z.enum(OPTION_KINDS),
  values: z.array(optionValueSchema).min(1, "Add at least one value.").max(30),
});

function uniqueBy<T>(items: T[], key: (item: T) => string | number): number[] {
  const seen = new Set<string | number>();
  const duplicates: number[] = [];
  items.forEach((item, i) => {
    const k = key(item);
    if (seen.has(k)) duplicates.push(i);
    seen.add(k);
  });
  return duplicates;
}

export const productInputSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, "SKU: 2–40 letters, numbers, - or _, e.g. BC-STD-001."),
    name: z.string().trim().min(2, "Enter a product name.").max(120),
    slug: slugSchema,
    categoryId: z.string().min(1, "Choose a category."),
    summary: optionalText(300),
    description: z.string().trim().min(1, "Enter a description.").max(10_000),
    basePrice: rupees("Base price"),
    minQuantity: int("Minimum quantity", 1, 100_000),
    quantityStep: int("Quantity step", 1, 100_000),
    turnaroundDays: int("Production time", 0, 90),
    status: z.enum(PRODUCT_STATUSES),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
    allowsDesignService: z.boolean(),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    affiliateCommission: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const bps = parsePercent(v);
        if (bps === null || bps > 5000) {
          ctx.addIssue({ code: "custom", message: "Affiliate commission must be between 0 and 50%." });
          return z.NEVER;
        }
        return bps;
      }),
    priceTiers: z
      .array(z.object({ minQuantity: int("Tier quantity", 2, 100_000), unitPrice: rupees("Tier price") }))
      .max(20),
    bulkDiscounts: z
      .array(
        z.object({
          minQuantity: int("Discount quantity", 2, 100_000),
          percent: percent("Discount", { min: 1, max: 9000 }),
        }),
      )
      .max(10),
    options: z.array(optionSchema).max(10),
  })
  .superRefine((p, ctx) => {
    for (const i of uniqueBy(p.priceTiers, (t) => t.minQuantity))
      ctx.addIssue({ code: "custom", path: ["priceTiers", i, "minQuantity"], message: "Each tier needs a different quantity." });
    for (const i of uniqueBy(p.bulkDiscounts, (d) => d.minQuantity))
      ctx.addIssue({ code: "custom", path: ["bulkDiscounts", i, "minQuantity"], message: "Each discount needs a different quantity." });
    for (const i of uniqueBy(p.options, (o) => o.name.toLowerCase()))
      ctx.addIssue({ code: "custom", path: ["options", i, "name"], message: "Option names must be unique." });
    p.options.forEach((o, oi) => {
      for (const vi of uniqueBy(o.values, (v) => v.label.toLowerCase()))
        ctx.addIssue({ code: "custom", path: ["options", oi, "values", vi, "label"], message: "Values must be unique." });
    });
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(80),
  slug: slugSchema,
  description: optionalText(300),
  parentId: z
    .string()
    .trim()
    .transform((v) => v || null),
  sortOrder: int("Sort order", 0, 10_000),
});
export type CategoryData = z.output<typeof categoryInputSchema>;

/** Errors keyed by field path, e.g. "options.0.values.1.label". */
export type FieldErrorMap = Record<string, string>;

export function issuesToErrors(error: z.ZodError): FieldErrorMap {
  const errors: FieldErrorMap = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    errors[key] ??= issue.message;
  }
  return errors;
}
