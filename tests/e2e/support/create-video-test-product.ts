// Creates a published test product with two images (copied from a seeded product), for the product video tests.
// Optionally sets a YouTube video directly. Prints { id, path } as JSON.
// Run with: tsx --conditions=react-server tests/e2e/support/create-video-test-product.ts <name> [youtubeUrl] [first]
import { prisma } from "@/lib/db";

async function main() {
  const [name, youtubeUrl, first] = process.argv.slice(2);
  const source = await prisma.product.findFirstOrThrow({
    where: { status: "PUBLISHED", images: { some: {} } },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 2 }, category: { select: { id: true, slug: true, parentId: true } } },
  });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const product = await prisma.product.create({
    data: {
      name,
      slug,
      sku: `VID-${slug.slice(-10).toUpperCase()}`,
      summary: "Test product with a video.",
      description: "Created by the product video end-to-end test.",
      categoryId: source.categoryId,
      basePriceMinor: 1000,
      status: "PUBLISHED",
      youtubeUrl: youtubeUrl || null,
      youtubeVideoFirst: first === "first",
      youtubeAddedAt: youtubeUrl ? new Date("2026-11-01T10:00:00Z") : null,
      images: { create: [0, 1].map((i) => ({ url: source.images[i % source.images.length].url, alt: `${name} photo ${i + 1}`, sortOrder: i })) },
    },
  });
  // The public path: /products/<category path>/<slug>
  const path: string[] = [];
  for (let c: { slug: string; parentId: string | null } | null = source.category; c; c = c.parentId ? await prisma.category.findUnique({ where: { id: c.parentId }, select: { slug: true, parentId: true } }) : null) {
    path.unshift(c.slug);
  }
  console.log(JSON.stringify({ id: product.id, path: `/products/${[...path, slug].join("/")}` }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
