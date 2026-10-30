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
    // Add-only: an existing product (and anything an admin changed on it) is never overwritten or trimmed.
    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        slug: p.slug,
        ...data,
        images: {
          create: p.imageViews.map((view, i) => ({ url: imagePath(p.slug, i), alt: `${p.name} — ${view}`, sortOrder: i })),
        },
        priceTiers: { create: (p.tiers ?? []).map(([minQuantity, unitPriceMinor]) => ({ minQuantity, unitPriceMinor })) },
        bulkDiscounts: { create: (p.bulkDiscounts ?? []).map(([minQuantity, percentBps]) => ({ minQuantity, percentBps })) },
        options: {
          create: p.options.map((o, i) => ({
            name: o.name,
            kind: o.kind,
            sortOrder: i,
            values: {
              create: o.values.map(([label, priceDeltaMinor, pricing], j) => ({ label, priceDeltaMinor, pricing: pricing ?? "PER_UNIT", sortOrder: j })),
            },
          })),
        },
      },
    });
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

  console.log(`Demo catalog checked: ${products.length} products (existing ones left untouched).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
