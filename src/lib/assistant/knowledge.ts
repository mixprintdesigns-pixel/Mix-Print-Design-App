import "server-only";
import { prisma } from "@/lib/db";
import { getAffiliateSettings } from "@/lib/affiliate/service";
import { BUSINESS } from "@/lib/business";
import { readCategoryTree } from "@/lib/catalog/queries";
import { ancestry, findById, flatten, productUrl, serviceUrl, type CategoryNode } from "@/lib/catalog/tree";
import { readAboutContent } from "@/lib/content/about";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";

// The AI assistant's knowledge base: a searchable copy of the website's own content
// (products, services/categories, About, contact, affiliate program, ordering FAQ), stored in KnowledgeChunk.
// It is rebuilt automatically whenever the underlying content changes.

export type Chunk = { sourceType: "PRODUCT" | "SERVICE" | "PAGE"; sourceId: string; title: string; url: string; content: string };

const INDEX_KEY = "knowledge-index";

async function productChunks(tree: CategoryNode[]): Promise<Chunk[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", categoryId: { in: flatten(tree).map((c) => c.id) } },
    include: {
      priceTiers: { orderBy: { minQuantity: "asc" } },
      bulkDiscounts: { orderBy: { minQuantity: "asc" } },
      options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  return products.map((p) => {
    const category = findById(tree, p.categoryId)!;
    const chain = ancestry(tree, category).map((c) => c.name).join(" › ");
    const tiers = p.priceTiers.map((t) => `${t.minQuantity}+ units: ${formatPKR(t.unitPriceMinor)} each`).join("; ");
    const options = p.options
      .map((o) => `${o.name}: ${o.values.map((v) => (v.priceDeltaMinor ? `${v.label} (+${formatPKR(v.priceDeltaMinor)}${v.pricing === "PER_ORDER" ? " once" : "/unit"})` : v.label)).join(", ")}`)
      .join(". ");
    const discounts = p.bulkDiscounts.map((d) => `${formatPercent(d.percentBps)} off from ${d.minQuantity} units`).join("; ");
    return {
      sourceType: "PRODUCT",
      sourceId: p.id,
      title: p.name,
      url: productUrl(category.path, p.slug),
      content: [
        `Product: ${p.name} (SKU ${p.sku}). Category: ${chain}.`,
        p.summary ?? "",
        p.description,
        `Price: from ${formatPKR(p.basePriceMinor)} per unit${tiers ? `; volume prices ${tiers}` : ""}. Minimum order ${p.minQuantity} units${p.quantityStep > 1 ? ` in steps of ${p.quantityStep}` : ""}.`,
        discounts ? `Bulk discounts: ${discounts}.` : "",
        options ? `Options: ${options}.` : "",
        `Production time about ${p.turnaroundDays} working days after proof approval. ${p.isAvailable ? "Available to order." : "Currently unavailable."}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

/** One chunk per visible category at every level (main service, category, sub-category). */
function categoryChunks(tree: CategoryNode[]): Chunk[] {
  return flatten(tree).map((c) => {
    const chain = ancestry(tree, c).map((a) => a.name);
    return {
      sourceType: "SERVICE" as const,
      sourceId: c.id,
      title: chain.join(": "),
      url: serviceUrl(c.path),
      content: [
        `Service: ${chain.join(" › ")}. ${c.description ?? ""}`,
        c.content ?? "",
        c.children.length ? `Types: ${c.children.map((s) => s.name).join(", ")}.` : "",
        c.priceFromMinor != null
          ? `Price: from ${formatPKR(c.priceFromMinor)}${c.priceUnit ? ` ${c.priceUnit}` : ""}; final price depends on size and quantity.`
          : "Prices are quoted per job: use Get Quote or WhatsApp.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

async function pageChunks(): Promise<Chunk[]> {
  const [about, affiliate] = await Promise.all([readAboutContent(), getAffiliateSettings()]);
  return [
    {
      sourceType: "PAGE",
      sourceId: "about",
      title: "About Mix Print Design",
      url: "/about",
      content: `${about.story}\nMission: ${about.mission}\nOwner: ${about.ownerName}, ${about.ownerTitle}. ${about.ownerBio}\nWhy choose us: ${about.highlights.map((h) => `${h.title}: ${h.text}`).join("; ")}`,
    },
    {
      sourceType: "PAGE",
      sourceId: "contact",
      title: "Contact us",
      url: "/contact",
      content: `${BUSINESS.name}, ${BUSINESS.address}. Phone and WhatsApp ${BUSINESS.phoneDisplay}. Email ${BUSINESS.email}. Facebook ${BUSINESS.facebookUrl}. Send a quote request through the contact form or WhatsApp.`,
    },
    {
      sourceType: "PAGE",
      sourceId: "affiliate",
      title: "Affiliate program",
      url: "/affiliate",
      content: `Earn a fixed commission per product (shown in the affiliate dashboard, e.g. Rs 200) or ${formatPercent(affiliate.defaultRateBps)} of product value on orders from people you refer with your link, whether they order on WhatsApp or in the website chat. Referral window ${affiliate.cookieDays} days. Commission is approved when the customer has paid in full, and cancelled for cancelled or refunded orders. Minimum withdrawal ${formatPKR(affiliate.minWithdrawalMinor)}, paid to JazzCash, Easypaisa or a bank account. No self-referrals. Join free at /affiliate/join; track clicks, orders and earnings in the affiliate dashboard.`,
    },
    {
      sourceType: "PAGE",
      sourceId: "payment",
      title: "Payment terms and order status",
      url: "/track",
      content: `Payment terms: 50% advance before work starts, and the remaining 50% after the work is complete, before delivery. Order steps: Pending (order received), Advance Received (work starts), In Progress, Work Completed (we send pictures of the finished work and request the remaining payment), Fully Paid, Delivered. Check your order status at /track with your order number and phone number. Payment by JazzCash, Easypaisa, bank transfer or cash. Questions about an order: WhatsApp ${BUSINESS.phoneDisplay}.`,
    },
    {
      sourceType: "PAGE",
      sourceId: "ordering",
      title: "How ordering works",
      url: "/products",
      content: `Choose a product, select size, paper, finish and quantity to see a live price, then press "Order on WhatsApp": WhatsApp opens with your order details for us to confirm (WhatsApp ${BUSINESS.phoneDisplay}). Upload your artwork or ask our designers to create it; nothing is printed until you approve a proof. Payment options: JazzCash, Easypaisa, bank transfer and cash on delivery. Delivery across Pakistan.`,
    },
  ];
}

export async function buildKnowledgeChunks(): Promise<Chunk[]> {
  const tree = await readCategoryTree();
  const [products, pages] = await Promise.all([productChunks(tree), pageChunks()]);
  return [...pages, ...categoryChunks(tree), ...products];
}

/** A cheap fingerprint of everything the index is built from. */
async function contentSignature(): Promise<string> {
  const latest = (rows: { _max: { updatedAt: Date | null }; _count: number }) => `${rows._count}:${rows._max.updatedAt?.getTime() ?? 0}`;
  const [products, categories, content, affiliate] = await Promise.all([
    prisma.product.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.category.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.siteContent.aggregate({ where: { key: { not: INDEX_KEY } }, _max: { updatedAt: true }, _count: true }),
    prisma.affiliateSettings.aggregate({ _max: { updatedAt: true }, _count: true }),
  ]);
  return [products, categories, content, affiliate].map(latest).join("|");
}

/** Rebuilds the index if any site content changed since it was last built. Returns true if rebuilt. */
export async function ensureFreshIndex(): Promise<boolean> {
  await getAffiliateSettings(); // creates the settings row if missing, so the signature below stays stable
  const signature = await contentSignature();
  const stored = await prisma.siteContent.findUnique({ where: { key: INDEX_KEY } });
  if ((stored?.value as { signature?: string } | null)?.signature === signature && (await prisma.knowledgeChunk.count()) > 0) {
    return false;
  }
  const chunks = await buildKnowledgeChunks();
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany(),
    prisma.knowledgeChunk.createMany({ data: chunks }),
    prisma.siteContent.upsert({
      where: { key: INDEX_KEY },
      create: { key: INDEX_KEY, value: { signature } },
      update: { value: { signature } },
    }),
  ]);
  return true;
}

export type SearchHit = { title: string; url: string; content: string; sourceType: string };

/** Full-text search over the index (PostgreSQL), with a simple word match as fallback. */
export async function searchKnowledge(query: string, limit = 6): Promise<SearchHit[]> {
  const q = query.slice(0, 300);
  const ranked = await prisma.$queryRaw<SearchHit[]>`
    SELECT title, url, content, "sourceType"
    FROM "KnowledgeChunk"
    WHERE to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', ${q})
    ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', ${q})) DESC
    LIMIT ${limit}`;
  if (ranked.length > 0) return ranked;

  // websearch_to_tsquery requires every word; fall back to "any word" matching.
  const words = [...new Set(q.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 8);
  if (words.length === 0) return [];
  const tsquery = words.join(" | ");
  return prisma.$queryRaw<SearchHit[]>`
    SELECT title, url, content, "sourceType"
    FROM "KnowledgeChunk"
    WHERE to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${tsquery})
    ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), to_tsquery('english', ${tsquery})) DESC
    LIMIT ${limit}`;
}
