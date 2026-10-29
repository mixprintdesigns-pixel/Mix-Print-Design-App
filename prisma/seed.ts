import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { resolveDatabaseUrl } from "../src/lib/database-url";
import { categories, imagePath, products } from "./seed-data";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl()! }) });

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: c });
  }

  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
    const data = {
      sku: p.slug.toUpperCase(),
      status: "PUBLISHED" as const,
      name: p.name,
      summary: p.summary,
      description: p.description,
      categoryId: category.id,
      basePriceMinor: p.basePriceMinor,
      minQuantity: p.minQuantity,
      quantityStep: p.quantityStep,
      turnaroundDays: p.turnaroundDays,
      isFeatured: p.isFeatured ?? false,
    };
    const product = await prisma.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });

    // Children are rebuilt so re-running the seed reflects edits to seed-data.ts.
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: product.id } }),
      prisma.priceTier.deleteMany({ where: { productId: product.id } }),
      prisma.bulkDiscount.deleteMany({ where: { productId: product.id } }),
      prisma.productOption.deleteMany({ where: { productId: product.id } }),
      prisma.productImage.createMany({
        data: p.imageViews.map((view, i) => ({
          productId: product.id,
          url: imagePath(p.slug, i),
          alt: `${p.name} — ${view}`,
          sortOrder: i,
        })),
      }),
      prisma.priceTier.createMany({
        data: (p.tiers ?? []).map(([minQuantity, unitPriceMinor]) => ({ productId: product.id, minQuantity, unitPriceMinor })),
      }),
      prisma.bulkDiscount.createMany({
        data: (p.bulkDiscounts ?? []).map(([minQuantity, percentBps]) => ({ productId: product.id, minQuantity, percentBps })),
      }),
      ...p.options.map((o, i) =>
        prisma.productOption.create({
          data: {
            productId: product.id,
            name: o.name,
            kind: o.kind,
            sortOrder: i,
            values: {
              create: o.values.map(([label, priceDeltaMinor, pricing], j) => ({
                label,
                priceDeltaMinor,
                pricing: pricing ?? "PER_UNIT",
                sortOrder: j,
              })),
            },
          },
        }),
      ),
    ]);
  }

  // Demo service qualities and product → service links (the three categories and Board Maker
  // sub-types come from the migration). Real qualities are added in Admin → Services.
  const qualities: Record<string, [slug: string, title: string, text: string][]> = {
    svc_board_backlit: [
      ["standard", "Standard", "Economical backlit flex for everyday shop signs."],
      ["premium", "Premium", "Brighter, more even light with premium translucent media."],
    ],
    svc_board_frontlit: [
      ["standard", "Standard", "Durable front-lit flex with lights mounted above."],
      ["premium", "Premium", "Heavier media and sharper print for long-lasting signs."],
    ],
    svc_board_3d: [
      ["acrylic", "Acrylic letters", "Glossy acrylic letters with optional LED lighting."],
      ["steel", "Steel letters", "Brushed or gold steel letters for a premium finish."],
      ["pvc", "PVC letters", "Lightweight, budget-friendly raised letters."],
    ],
  };
  for (const [subtypeId, list] of Object.entries(qualities)) {
    if (!(await prisma.serviceSubtype.findUnique({ where: { id: subtypeId } }))) continue;
    for (const [i, [slug, title, shortDescription]] of list.entries()) {
      await prisma.serviceQuality.upsert({
        where: { subtypeId_slug: { subtypeId, slug } },
        create: { subtypeId, slug, title, shortDescription, sortOrder: i },
        update: {},
      });
    }
  }
  const productServices: Record<string, string> = {
    "standard-business-cards": "svc_offset",
    "velvet-business-cards": "svc_offset",
    "a5-flyers": "svc_offset",
    "trifold-brochures": "svc_offset",
    letterheads: "svc_offset",
    envelopes: "svc_offset",
    "mailer-boxes": "svc_offset",
    "flex-banner": "svc_digital",
    "roll-up-standee": "svc_digital",
    "die-cut-stickers": "svc_digital",
  };
  for (const [slug, serviceCategoryId] of Object.entries(productServices)) {
    if (await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } })) {
      await prisma.product.updateMany({ where: { slug, serviceCategoryId: null }, data: { serviceCategoryId } });
    }
  }

  // Demo admin for local development only.
  if (process.env.NODE_ENV !== "production") {
    const email = "admin@mixprint.local";
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "MixPrint Admin", role: "ADMIN", passwordHash: await hashPassword("ChangeMe12345") },
      update: {},
    });
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
