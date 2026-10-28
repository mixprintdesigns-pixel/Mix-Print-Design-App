import { prisma } from "@/lib/db";

/** Empties every table between tests. */
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

/** A configurable product: base PKR 3.00/unit, min 100 in steps of 100, tier at 500. */
export async function createTestProduct(overrides: { isActive?: boolean; slug?: string } = {}) {
  const category = await prisma.category.create({
    data: { name: "Cards", slug: `cards-${Math.random().toString(36).slice(2, 8)}` },
  });
  return prisma.product.create({
    data: {
      name: "Test Cards",
      slug: overrides.slug ?? `test-cards-${Math.random().toString(36).slice(2, 8)}`,
      description: "Test",
      categoryId: category.id,
      basePriceMinor: 300,
      minQuantity: 100,
      quantityStep: 100,
      isActive: overrides.isActive ?? true,
      priceTiers: { create: [{ minQuantity: 500, unitPriceMinor: 250 }] },
      options: {
        create: [
          {
            name: "Paper",
            sortOrder: 0,
            values: { create: [{ label: "Matte", priceDeltaMinor: 0 }, { label: "Gloss", priceDeltaMinor: 50, sortOrder: 1 }] },
          },
          {
            name: "Sides",
            sortOrder: 1,
            values: { create: [{ label: "Single", priceDeltaMinor: 0 }, { label: "Double", priceDeltaMinor: 100, sortOrder: 1 }] },
          },
        ],
      },
    },
    include: { options: { include: { values: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
  });
}
