import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { deleteLevel, linkProduct, moveLevel, saveLevel, ServiceAdminError, setLevelImage, unlinkProduct } from "@/lib/services/admin";
import { createTestProduct, resetDatabase } from "../support/db";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const level = (title: string, extra: { slug?: string; isVisible?: boolean } = {}) => ({
  title,
  slug: extra.slug,
  shortDescription: `${title} description`,
  isVisible: extra.isVisible ?? true,
});

beforeEach(resetDatabase);

describe("service hierarchy", () => {
  it("creates categories, sub-types and qualities with slugs and order", async () => {
    const board = await saveLevel("category", null, null, level("Board Maker"));
    const backlit = await saveLevel("subtype", null, board, level("Backlit"));
    const frontlit = await saveLevel("subtype", null, board, level("Front-lit"));
    await saveLevel("quality", null, backlit, level("Standard"));
    await saveLevel("quality", null, backlit, level("Premium"));

    const tree = await prisma.serviceCategory.findUniqueOrThrow({
      where: { id: board },
      include: { subtypes: { orderBy: { sortOrder: "asc" }, include: { qualities: { orderBy: { sortOrder: "asc" } } } } },
    });
    expect(tree.slug).toBe("board-maker");
    expect(tree.subtypes.map((s) => s.slug)).toEqual(["backlit", "front-lit"]);
    expect(tree.subtypes[0].qualities.map((q) => q.title)).toEqual(["Standard", "Premium"]);

    await moveLevel("subtype", frontlit, "up");
    const order = await prisma.serviceSubtype.findMany({ where: { categoryId: board }, orderBy: { sortOrder: "asc" } });
    expect(order.map((s) => s.title)).toEqual(["Front-lit", "Backlit"]);
  });

  it("rejects duplicate slugs among siblings but allows them elsewhere", async () => {
    const a = await saveLevel("category", null, null, level("Board Maker"));
    const b = await saveLevel("category", null, null, level("Signs"));
    await saveLevel("subtype", null, a, level("Backlit"));
    await expect(saveLevel("subtype", null, a, level("Backlit"))).rejects.toThrow(ServiceAdminError);
    await expect(saveLevel("subtype", null, b, level("Backlit"))).resolves.toBeTruthy();
  });

  it("places products at any level and keeps their ids consistent", async () => {
    const board = await saveLevel("category", null, null, level("Board Maker"));
    const backlit = await saveLevel("subtype", null, board, level("Backlit"));
    const premium = await saveLevel("quality", null, backlit, level("Premium"));
    const product = await createTestProduct();

    await linkProduct(product.id, "quality", premium);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      serviceCategoryId: board,
      serviceSubtypeId: backlit,
      serviceQualityId: premium,
    });
    await linkProduct(product.id, "category", board);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      serviceCategoryId: board,
      serviceSubtypeId: null,
      serviceQualityId: null,
    });
    await unlinkProduct(product.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).serviceCategoryId).toBeNull();
  });

  it("refuses to delete levels with linked products, and deletes children otherwise", async () => {
    const board = await saveLevel("category", null, null, level("Board Maker"));
    const backlit = await saveLevel("subtype", null, board, level("Backlit"));
    const quality = await saveLevel("quality", null, backlit, level("Standard"));
    const product = await createTestProduct();
    await linkProduct(product.id, "quality", quality);

    await expect(deleteLevel("category", board)).rejects.toThrow(/Products are linked/);
    await unlinkProduct(product.id);
    await setLevelImage("quality", quality, PNG);
    await deleteLevel("category", board);
    expect(await prisma.serviceQuality.count()).toBe(0);
  });

  it("validates uploaded images", async () => {
    const board = await saveLevel("category", null, null, level("Board Maker"));
    await expect(setLevelImage("category", board, new TextEncoder().encode("<svg/>"))).rejects.toThrow(/JPG, PNG or WebP/);
    await setLevelImage("category", board, PNG);
    expect((await prisma.serviceCategory.findUniqueOrThrow({ where: { id: board } })).imageUrl).toMatch(/^\/media\/services\//);
  });
});
