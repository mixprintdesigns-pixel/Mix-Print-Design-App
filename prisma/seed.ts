import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { resolveDatabaseUrl } from "../src/lib/database-url";
import { imagePath, products } from "./seed-data";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl()! }) });

/** Finds a category by its slug path ("offset-printing/business-cards"); the tree itself comes from the migrations. */
async function categoryAt(path: string) {
  let parentId: string | null = null;
  for (const slug of path.split("/")) {
    const found: { id: string } | null = await prisma.category.findFirst({ where: { parentId, slug }, select: { id: true } });
    if (!found) throw new Error(`Seed: category "${path}" not found. Run the migrations first.`);
    parentId = found.id;
  }
  return { id: parentId! };
}

async function main() {
  for (const p of products) {
    const category = await categoryAt(p.category);
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

  // Demo admin for local development only.
  if (process.env.NODE_ENV !== "production") {
    const email = "admin@mixprint.local";
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "MixPrint Admin", role: "ADMIN", passwordHash: await hashPassword("ChangeMe12345") },
      update: {},
    });
  }

  console.log(`Seeded ${products.length} demo products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
