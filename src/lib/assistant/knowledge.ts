import "server-only";
import { prisma } from "@/lib/db";
import { getAffiliateSettings } from "@/lib/affiliate/service";
import { BUSINESS } from "@/lib/business";
import { readAboutContent } from "@/lib/content/about";
import { formatPKR } from "@/lib/money";
import { formatPercent } from "@/lib/pricing";

// The AI assistant's knowledge base: a searchable copy of the website's own content
// (products, services, About, contact, affiliate program, ordering FAQ), stored in KnowledgeChunk.
// It is rebuilt automatically whenever the underlying content changes.

export type Chunk = { sourceType: "PRODUCT" | "SERVICE" | "PAGE"; sourceId: string; title: string; url: string; content: string };

const INDEX_KEY = "knowledge-index";

async function productChunks(): Promise<Chunk[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: {
      category: { select: { name: true } },
      priceTiers: { orderBy: { minQuantity: "asc" } },
      bulkDiscounts: { orderBy: { minQuantity: "asc" } },
      options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
      serviceCategory: { select: { title: true } },
    },
  });
  return products.map((p) => {
    const tiers = p.priceTiers.map((t) => `${t.minQuantity}+ units: ${formatPKR(t.unitPriceMinor)} each`).join("; ");
    const options = p.options
      .map((o) => `${o.name}: ${o.values.map((v) => (v.priceDeltaMinor ? `${v.label} (+${formatPKR(v.priceDeltaMinor)}${v.pricing === "PER_ORDER" ? " once" : "/unit"})` : v.label)).join(", ")}`)
      .join(". ");
    const discounts = p.bulkDiscounts.map((d) => `${formatPercent(d.percentBps)} off from ${d.minQuantity} units`).join("; ");
    return {
      sourceType: "PRODUCT",
      sourceId: p.id,
      title: p.name,
      url: `/products/${p.slug}`,
      content: [
        `Product: ${p.name} (SKU ${p.sku}). Category: ${p.category.name}${p.serviceCategory ? `. Service: ${p.serviceCategory.title}` : ""}.`,
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

async function serviceChunks(): Promise<Chunk[]> {
  const categories = await prisma.serviceCategory.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
    include: {
      subtypes: {
        where: { isVisible: true },
        orderBy: { sortOrder: "asc" },
        include: { qualities: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } },
      },
      products: { where: { status: "PUBLISHED" }, select: { name: true } },
    },
  });
  return categories.flatMap((c) => [
    {
      sourceType: "SERVICE" as const,
      sourceId: c.id,
      title: c.title,
      url: `/services/${c.slug}`,
      content: [
        `Service: ${c.title}. ${c.shortDescription}`,
        c.subtypes.length ? `Types: ${c.subtypes.map((s) => s.title).join(", ")}.` : "",
        c.products.length ? `Products: ${c.products.map((p) => p.name).join(", ")}.` : "",
        "Prices for this service are quoted per job: use Get Quote or WhatsApp.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...c.subtypes.map((s) => ({
      sourceType: "SERVICE" as const,
      sourceId: s.id,
      title: `${c.title}: ${s.title}`,
      url: `/services/${c.slug}#${s.slug}`,
      content: [
        `${s.title} (${c.title}). ${s.shortDescription}`,
        s.qualities.length ? `Qualities: ${s.qualities.map((q) => `${q.title} — ${q.shortDescription}`).join("; ")}.` : "",
        "Prices are quoted per size and quality: use Get Quote or WhatsApp.",
      ]
        .filter(Boolean)
        .join("\n"),
    })),
  ]);
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
      content: `Earn ${formatPercent(affiliate.defaultRateBps)} commission (some products pay more) on orders from people you refer with your link. Referral window ${affiliate.cookieDays} days. Commission is confirmed ${affiliate.holdDays} days after delivery and cancelled for cancelled or refunded orders. Minimum withdrawal ${formatPKR(affiliate.minWithdrawalMinor)}, paid to JazzCash, Easypaisa or a bank account. No self-referrals. Join free at /affiliate/join; track clicks, orders and earnings in the affiliate dashboard.`,
    },
    {
      sourceType: "PAGE",
      sourceId: "ordering",
      title: "How ordering works",
      url: "/products",
      content: `Choose a product, select size, paper, finish and quantity to see a live price, and add it to the cart. Upload your artwork or ask our designers to create it; nothing is printed until you approve a proof. Online checkout is being finalised: to place an order now, send your cart details through the contact form or WhatsApp ${BUSINESS.phoneDisplay}. Payment options: JazzCash, Easypaisa, bank transfer and cash on delivery. Delivery across Pakistan.`,
    },
  ];
}

export async function buildKnowledgeChunks(): Promise<Chunk[]> {
  const [products, services, pages] = await Promise.all([productChunks(), serviceChunks(), pageChunks()]);
  return [...pages, ...services, ...products];
}

/** A cheap fingerprint of everything the index is built from. */
async function contentSignature(): Promise<string> {
  const latest = (rows: { _max: { updatedAt: Date | null }; _count: number }) => `${rows._count}:${rows._max.updatedAt?.getTime() ?? 0}`;
  const [products, cats, subs, quals, content, affiliate] = await Promise.all([
    prisma.product.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.serviceCategory.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.serviceSubtype.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.serviceQuality.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.siteContent.aggregate({ where: { key: { not: INDEX_KEY } }, _max: { updatedAt: true }, _count: true }),
    prisma.affiliateSettings.aggregate({ _max: { updatedAt: true }, _count: true }),
  ]);
  return [products, cats, subs, quals, content, affiliate].map(latest).join("|");
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
