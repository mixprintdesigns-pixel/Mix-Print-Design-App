// DEMO catalog for development, tests and previews only. These are NOT real MixPrint products
// or prices: the real catalog is configured by administrators in /admin/products.
// Prices are in paisa (PKR × 100).

export type SeedOption = {
  name: string;
  kind: "SIZE" | "MATERIAL" | "FINISHING" | "OTHER";
  values: [label: string, priceDeltaMinor: number, pricing?: "PER_UNIT" | "PER_ORDER"][];
};
export type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  basePriceMinor: number;
  minQuantity: number;
  quantityStep: number;
  turnaroundDays: number;
  isFeatured?: boolean;
  tiers?: [minQuantity: number, unitPriceMinor: number][];
  bulkDiscounts?: [minQuantity: number, percentBps: number][];
  options: SeedOption[];
  imageViews: string[]; // one image is generated per view
};

export const categories = [
  { slug: "business-cards", name: "Business Cards", description: "Make a strong first impression.", sortOrder: 1 },
  { slug: "marketing", name: "Flyers & Brochures", description: "Promote offers, menus and events.", sortOrder: 2 },
  { slug: "large-format", name: "Banners & Standees", description: "Big, bold signage for shops and events.", sortOrder: 3 },
  { slug: "stickers-labels", name: "Stickers & Labels", description: "Die-cut stickers and product labels.", sortOrder: 4 },
  { slug: "packaging", name: "Packaging", description: "Branded boxes and bags.", sortOrder: 5 },
  { slug: "stationery", name: "Office Stationery", description: "Letterheads, envelopes and more.", sortOrder: 6 },
];

const sides: SeedOption = { name: "Printed sides", kind: "OTHER", values: [["Front only", 0], ["Front & back", 100]] };

export const products: SeedProduct[] = [
  {
    slug: "standard-business-cards",
    name: "Standard Business Cards",
    category: "business-cards",
    summary: "Classic 3.5 × 2 inch cards on thick premium card stock.",
    description:
      "Our best-selling business cards, printed in full colour on 350–400gsm card.\n\nUpload your own artwork or ask our design team to create one for you. You will receive a digital proof to approve before anything is printed.",
    basePriceMinor: 300,
    minQuantity: 100,
    quantityStep: 100,
    turnaroundDays: 3,
    isFeatured: true,
    tiers: [[500, 250], [1000, 200], [2000, 160]],
    options: [
      { name: "Paper", kind: "MATERIAL", values: [["350gsm Matte", 0], ["400gsm Gloss", 50], ["Textured Linen", 150]] },
      sides,
      { name: "Finish", kind: "FINISHING", values: [["None", 0], ["Rounded corners", 50], ["Spot UV", 200]] },
    ],
    imageViews: ["Front", "Back", "Stack", "Paper samples"],
  },
  {
    slug: "velvet-business-cards",
    name: "Velvet Touch Business Cards",
    category: "business-cards",
    summary: "Soft-touch laminated cards with an ultra-premium feel.",
    description: "450gsm board with velvet lamination on both sides. Pairs beautifully with gold or silver foil.",
    basePriceMinor: 1200,
    minQuantity: 100,
    quantityStep: 100,
    turnaroundDays: 5,
    isFeatured: true,
    tiers: [[500, 1000], [1000, 850]],
    options: [
      { name: "Foil", kind: "FINISHING", values: [["No foil", 0], ["Gold foil", 400], ["Silver foil", 400]] },
      sides,
    ],
    imageViews: ["Front", "Foil detail", "Box of cards"],
  },
  {
    slug: "a5-flyers",
    name: "A5 Flyers",
    category: "marketing",
    summary: "Full-colour flyers for menus, offers and events.",
    description: "Printed on glossy art paper. Ideal for restaurant menus, sale announcements and door-to-door distribution.",
    basePriceMinor: 1500,
    minQuantity: 100,
    quantityStep: 50,
    turnaroundDays: 2,
    isFeatured: true,
    tiers: [[500, 900], [1000, 650], [5000, 450]],
    bulkDiscounts: [[10000, 500]],
    options: [
      { name: "Paper", kind: "MATERIAL", values: [["130gsm Gloss", 0], ["170gsm Gloss", 300], ["170gsm Matte", 300]] },
      { name: "Printed sides", kind: "OTHER", values: [["Front only", 0], ["Front & back", 400]] },
    ],
    imageViews: ["Front", "Back", "Fanned stack"],
  },
  {
    slug: "trifold-brochures",
    name: "Tri-fold Brochures (A4)",
    category: "marketing",
    summary: "A4 brochures folded into three panels.",
    description: "Perfect for company profiles, price lists and product catalogues. Printed both sides and machine folded.",
    basePriceMinor: 4500,
    minQuantity: 50,
    quantityStep: 50,
    turnaroundDays: 4,
    tiers: [[250, 3500], [1000, 2500]],
    options: [{ name: "Paper", kind: "MATERIAL", values: [["150gsm Gloss", 0], ["200gsm Matte", 800]] }],
    imageViews: ["Folded", "Open spread"],
  },
  {
    slug: "flex-banner",
    name: "Vinyl Flex Banner",
    category: "large-format",
    summary: "Weather-proof banners for shop fronts and events.",
    description: "High-resolution solvent printing on 13oz flex. Hemmed edges with metal eyelets for easy hanging.",
    basePriceMinor: 350000,
    minQuantity: 1,
    quantityStep: 1,
    turnaroundDays: 2,
    isFeatured: true,
    options: [
      { name: "Size", kind: "SIZE", values: [["3 × 6 ft", 0], ["4 × 8 ft", 250000], ["6 × 10 ft", 650000]] },
      { name: "Finishing", kind: "FINISHING", values: [["Hemmed with eyelets", 0], ["Pole pockets", 30000]] },
    ],
    imageViews: ["Shop front", "Eyelet detail", "Event stage"],
  },
  {
    slug: "roll-up-standee",
    name: "Roll-up Standee",
    category: "large-format",
    summary: "Portable 2.5 × 6.5 ft retractable banner with carry bag.",
    description: "Aluminium base, printed media and nylon carry bag included. Sets up in under a minute.",
    basePriceMinor: 1100000,
    minQuantity: 1,
    quantityStep: 1,
    turnaroundDays: 3,
    options: [{ name: "Stand", kind: "OTHER", values: [["Economy", 0], ["Premium wide base", 350000]] }],
    imageViews: ["Standing", "Base & bag"],
  },
  {
    slug: "die-cut-stickers",
    name: "Die-cut Stickers",
    category: "stickers-labels",
    summary: "Custom shaped stickers cut to your design.",
    description: "Great for packaging, laptops and giveaways. Choose paper for indoor use or vinyl for durability.",
    basePriceMinor: 2500,
    minQuantity: 50,
    quantityStep: 50,
    turnaroundDays: 3,
    isFeatured: true,
    tiers: [[250, 1500], [1000, 900]],
    options: [
      { name: "Size", kind: "SIZE", values: [["2 inch", 0], ["3 inch", 800], ["4 inch", 1500]] },
      { name: "Material", kind: "MATERIAL", values: [["Gloss paper", 0], ["Waterproof vinyl", 700], ["Transparent", 1000]] },
      { name: "Cutting", kind: "FINISHING", values: [["Standard shapes", 0], ["Custom die (one-time setup)", 150000, "PER_ORDER"]] },
    ],
    imageViews: ["Sheet", "On laptop", "Shapes"],
  },
  {
    slug: "mailer-boxes",
    name: "Custom Mailer Boxes",
    category: "packaging",
    summary: "Branded corrugated boxes for e-commerce shipping.",
    description: "Sturdy E-flute mailer boxes printed in full colour. Flat-packed and easy to assemble.",
    basePriceMinor: 18000,
    minQuantity: 100,
    quantityStep: 50,
    turnaroundDays: 7,
    isFeatured: true,
    tiers: [[500, 14000], [1000, 11000]],
    bulkDiscounts: [[2000, 500], [5000, 1000]],
    options: [
      { name: "Size", kind: "SIZE", values: [["Small (8×6×2 in)", 0], ["Medium (10×8×4 in)", 3000], ["Large (14×10×4 in)", 6000]] },
      { name: "Print", kind: "OTHER", values: [["Outside only", 0], ["Inside & outside", 4000]] },
    ],
    imageViews: ["Closed", "Open", "Stacked"],
  },
  {
    slug: "letterheads",
    name: "Letterheads",
    category: "stationery",
    summary: "A4 letterheads on 100gsm bond paper.",
    description: "Professional letterheads that work in inkjet and laser printers.",
    basePriceMinor: 1200,
    minQuantity: 100,
    quantityStep: 100,
    turnaroundDays: 3,
    tiers: [[500, 900], [1000, 700]],
    options: [{ name: "Paper", kind: "MATERIAL", values: [["100gsm Bond", 0], ["120gsm Premium", 300]] }],
    imageViews: ["Front", "On desk"],
  },
  {
    slug: "envelopes",
    name: "Printed Envelopes",
    category: "stationery",
    summary: "Branded envelopes with your logo and return address.",
    description: "Available in common office sizes with peel-and-seal closure.",
    basePriceMinor: 2000,
    minQuantity: 100,
    quantityStep: 100,
    turnaroundDays: 4,
    tiers: [[500, 1600], [1000, 1300]],
    options: [{ name: "Size", kind: "SIZE", values: [["DL (110×220 mm)", 0], ["A4 (229×324 mm)", 1500]] }],
    imageViews: ["Front", "Back flap"],
  },
];

export function imagePath(slug: string, index: number): string {
  return `/products/${slug}-${index + 1}.svg`;
}
