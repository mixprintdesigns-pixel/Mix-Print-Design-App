import type { ProductInput } from "@/lib/admin/product-input";

export const validProduct: ProductInput = {
  sku: "bc-std-001",
  name: "Business Cards",
  slug: "business-cards-std",
  categoryId: "cat",
  summary: "",
  description: "Printed on 350gsm card.",
  basePrice: "3.50",
  minQuantity: 100,
  quantityStep: 100,
  turnaroundDays: 3,
  status: "DRAFT",
  isAvailable: true,
  isFeatured: false,
  allowsDesignService: true,
  seoTitle: "",
  seoDescription: "",
  affiliateCommission: "7.5",
  priceTiers: [{ minQuantity: 500, unitPrice: "2.75" }],
  bulkDiscounts: [{ minQuantity: 2000, percent: "5" }],
  options: [
    {
      name: "Paper",
      kind: "MATERIAL",
      values: [
        { label: "Matte", priceDelta: "0", pricing: "PER_UNIT" },
        { label: "Spot UV plate", priceDelta: "1,500", pricing: "PER_ORDER" },
      ],
    },
  ],
};
