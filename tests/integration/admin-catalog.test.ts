import { existsSync } from "node:fs";
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addProductImage,
  AdminInputError,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  moveCategory,
  reorderProductImages,
  saveCategory,
  saveProduct,
  setCategoryImage,
  setCategoryVisibility,
} from "@/lib/admin/catalog-service";
import { categoryInputSchema, productInputSchema, type CategoryData, type ProductInput } from "@/lib/admin/product-input";
import { readCategoryTree } from "@/lib/catalog/queries";
import { findByPath } from "@/lib/catalog/tree";
import { addCartItem, createGuestCart, getCartView } from "@/lib/cart/service";
import { registerUser } from "@/lib/auth/service";
import { resolveLocal } from "@/lib/storage";
import { resetDatabase } from "../support/db";
import { validProduct } from "../support/fixtures";

let PNG: Uint8Array;
let categoryId: string;

beforeAll(async () => {
  PNG = new Uint8Array(
    await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 194, g: 24, b: 91 } } }).png().toBuffer(),
  );
});

/** Category form data with defaults for the fields a test doesn't care about. */
const cat = (data: Partial<Record<keyof CategoryData, unknown>> & { name: string; slug: string }): CategoryData =>
  categoryInputSchema.parse({
    description: "",
    content: "",
    parentId: "",
    sortOrder: 0,
    isVisible: true,
    priceFrom: "",
    priceUnit: "",
    imageAlt: "",
    seoTitle: "",
    seoDescription: "",
    ...data,
  });

const input = (overrides: Partial<ProductInput> = {}) => productInputSchema.parse({ ...validProduct, categoryId, ...overrides });

async function rejects(promise: Promise<unknown>, field: string, message: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AdminInputError);
  expect((error as AdminInputError).field).toBe(field);
  expect((error as AdminInputError).message).toMatch(message);
}

beforeEach(async () => {
  await resetDatabase();
  categoryId = await saveCategory(null, cat({ name: "Cards", slug: "cards" }));
});

describe("saving products", () => {
  it("saves a fixed affiliate commission in rupees", async () => {
    const id = await saveProduct(null, input({ affiliateCommissionAmount: "200" }));
    expect(await prisma.product.findUniqueOrThrow({ where: { id } })).toMatchObject({ affiliateCommissionMinor: 20_000 });
    expect(productInputSchema.safeParse({ ...validProduct, categoryId, affiliateCommissionAmount: "two hundred" }).success).toBe(false);
  });

  it("creates a draft with tiers, discounts and options", async () => {
    const id = await saveProduct(null, input());
    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { priceTiers: true, bulkDiscounts: true, options: { include: { values: { orderBy: { sortOrder: "asc" } } } } },
    });
    expect(product).toMatchObject({ sku: "BC-STD-001", status: "DRAFT", basePriceMinor: 350, affiliateCommissionBps: 750 });
    expect(product.priceTiers).toMatchObject([{ minQuantity: 500, unitPriceMinor: 275 }]);
    expect(product.bulkDiscounts).toMatchObject([{ minQuantity: 2000, percentBps: 500 }]);
    expect(product.options[0]).toMatchObject({ name: "Paper", kind: "MATERIAL" });
    expect(product.options[0].values.map((v) => [v.label, v.pricing])).toEqual([
      ["Matte", "PER_UNIT"],
      ["Spot UV plate", "PER_ORDER"],
    ]);
  });

  it("refuses to publish without an image, then publishes once one is added", async () => {
    await rejects(saveProduct(null, input({ status: "PUBLISHED" })), "status", /at least one image/);
    const id = await saveProduct(null, input());
    await rejects(saveProduct(id, input({ status: "PUBLISHED" })), "status", /at least one image/);
    await addProductImage(id, PNG);
    await saveProduct(id, input({ status: "PUBLISHED" }));
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");
  });

  it("reports duplicate SKUs and slugs on the right field", async () => {
    await saveProduct(null, input());
    await rejects(saveProduct(null, input({ slug: "other-slug" })), "sku", /SKU/);
    await rejects(saveProduct(null, input({ sku: "OTHER-1" })), "slug", /slug/);
  });

  it("rejects an unknown category", async () => {
    await rejects(saveProduct(null, input({ categoryId: "missing" })), "categoryId", /category/);
  });

  it("keeps option value ids when editing, so existing carts still work", async () => {
    const id = await saveProduct(null, input());
    await addProductImage(id, PNG);
    await saveProduct(id, input({ status: "PUBLISHED" }));
    const before = await prisma.productOption.findFirstOrThrow({ where: { productId: id }, include: { values: { orderBy: { sortOrder: "asc" } } } });
    const [matte, plate] = before.values;

    const cartId = await createGuestCart("guest");
    await addCartItem(cartId, { productId: id, quantity: 100, optionValueIds: [matte.id] });

    // Rename + reprice Matte, swap order, add Gloss, keep the option id.
    await saveProduct(
      id,
      input({
        status: "PUBLISHED",
        options: [
          {
            id: before.id,
            name: "Paper stock",
            kind: "MATERIAL",
            values: [
              { id: plate.id, label: "Spot UV plate", priceDelta: "2000", pricing: "PER_ORDER" },
              { id: matte.id, label: "Matte 350gsm", priceDelta: "0.25", pricing: "PER_UNIT" },
              { label: "Gloss", priceDelta: "0.5", pricing: "PER_UNIT" },
            ],
          },
        ],
      }),
    );

    const after = await prisma.productOption.findFirstOrThrow({ where: { productId: id }, include: { values: { orderBy: { sortOrder: "asc" } } } });
    expect(after.id).toBe(before.id);
    expect(after.values.map((v) => v.label)).toEqual(["Spot UV plate", "Matte 350gsm", "Gloss"]);
    expect(after.values[1].id).toBe(matte.id);

    const [line] = (await getCartView(cartId)).lines;
    expect(line.problem).toBeNull();
    expect(line.selection[0].value).toBe("Matte 350gsm");
    expect(line.unitPriceMinor).toBe(350 + 25);
  });

  it("swaps option names without unique-constraint errors and deletes removed options", async () => {
    const id = await saveProduct(
      null,
      input({
        options: [
          { name: "Size", kind: "SIZE", values: [{ label: "A4", priceDelta: "0", pricing: "PER_UNIT" }] },
          { name: "Paper", kind: "MATERIAL", values: [{ label: "Matte", priceDelta: "0", pricing: "PER_UNIT" }] },
        ],
      }),
    );
    const [size, paper] = await prisma.productOption.findMany({ where: { productId: id }, orderBy: { sortOrder: "asc" }, include: { values: true } });
    await saveProduct(
      id,
      input({
        options: [
          { id: size.id, name: "Paper", kind: "MATERIAL", values: [{ id: size.values[0].id, label: "Matte", priceDelta: "0", pricing: "PER_UNIT" }] },
        ],
      }),
    );
    const options = await prisma.productOption.findMany({ where: { productId: id } });
    expect(options.map((o) => [o.id, o.name])).toEqual([[size.id, "Paper"]]);
    expect(await prisma.productOptionValue.count({ where: { optionId: paper.id } })).toBe(0);
  });
});

describe("product images", () => {
  it("stores, orders and deletes images", async () => {
    const id = await saveProduct(null, input());
    const first = await addProductImage(id, PNG, "Front");
    const second = await addProductImage(id, PNG);
    // Uploads are converted to WebP and named after the image description.
    expect(first.storageKey).toMatch(/^products\/[^/]+\/front-[0-9a-f]{6}\.webp$/);
    expect(first.url).toMatch(/^\/media\/products\//);
    expect(second.alt).toBe("Business Cards");
    expect(existsSync(resolveLocal(first.storageKey!))).toBe(true);

    await reorderProductImages(id, [second.id, first.id]);
    const ordered = await prisma.productImage.findMany({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
    expect(ordered.map((i) => i.id)).toEqual([second.id, first.id]);
    await expect(reorderProductImages(id, [second.id])).rejects.toThrow(AdminInputError);

    await deleteProductImage(id, first.id);
    expect(existsSync(resolveLocal(first.storageKey!))).toBe(false);
    await deleteProduct(id);
  });

  it("rejects files that are not images", async () => {
    const id = await saveProduct(null, input());
    await rejects(addProductImage(id, new TextEncoder().encode("<svg/>")), "image", /JPG, PNG or WebP/);
  });

  it("keeps at least one image on a published product", async () => {
    const id = await saveProduct(null, input());
    const image = await addProductImage(id, PNG);
    await saveProduct(id, input({ status: "PUBLISHED" }));
    await rejects(deleteProductImage(id, image.id), "_form", /at least one image/);
    await deleteProduct(id);
  });

  it("cannot touch another product's images", async () => {
    const a = await saveProduct(null, input());
    const b = await saveProduct(null, input({ sku: "B-1", slug: "b-1" }));
    const image = await addProductImage(a, PNG);
    await deleteProductImage(b, image.id);
    expect(await prisma.productImage.count({ where: { id: image.id } })).toBe(1);
    await deleteProduct(a);
  });
});

describe("deleting products", () => {
  it("deletes unordered products and archives ordered ones", async () => {
    const unordered = await saveProduct(null, input());
    expect(await deleteProduct(unordered)).toBe("deleted");
    expect(await prisma.product.count({ where: { id: unordered } })).toBe(0);

    const ordered = await saveProduct(null, input({ sku: "ORD-1", slug: "ordered" }));
    const user = await registerUser({ name: "Buyer", email: "b@example.com", password: "password123", phone: undefined });
    await prisma.order.create({
      data: {
        number: "MP-1",
        userId: user.id,
        subtotalMinor: 100,
        totalMinor: 100,
        shippingAddress: {},
        items: {
          create: { productId: ordered, productName: "x", optionsSummary: [], quantity: 1, unitPriceMinor: 100, lineTotalMinor: 100 },
        },
      },
    });
    expect(await deleteProduct(ordered)).toBe("archived");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: ordered } })).status).toBe("ARCHIVED");
  });
});

describe("categories", () => {
  it("supports subcategories and prevents loops", async () => {
    const child = await saveCategory(null, cat({ name: "Premium", slug: "premium", parentId: categoryId }));
    const grandchild = await saveCategory(null, cat({ name: "Foil", slug: "foil", parentId: child }));
    await rejects(
      saveCategory(categoryId, cat({ name: "Cards", slug: "cards", parentId: grandchild })),
      "parentId",
      /inside itself/,
    );
    await rejects(saveCategory(null, cat({ name: "Dup", slug: "cards" })), "slug", /slug/);
  });

  it("refuses to delete categories that still have products or subcategories", async () => {
    await saveProduct(null, input());
    await rejects(deleteCategory(categoryId), "_form", /products/);
    const parent = await saveCategory(null, cat({ name: "Parent", slug: "parent" }));
    await saveCategory(null, cat({ name: "Child", slug: "child", parentId: parent }));
    await rejects(deleteCategory(parent), "_form", /subcategories/);
  });

  it("allows the same slug under different parents, but not twice at one level", async () => {
    const offset = await saveCategory(null, cat({ name: "Offset", slug: "offset" }));
    const digital = await saveCategory(null, cat({ name: "Digital", slug: "digital" }));
    await saveCategory(null, cat({ name: "Banners", slug: "banners", parentId: offset }));
    await saveCategory(null, cat({ name: "Banners", slug: "banners", parentId: digital }));
    await rejects(saveCategory(null, cat({ name: "Banners 2", slug: "banners", parentId: digital })), "slug", /at this level/);
  });

  it("builds the shared tree with paths, subtree product counts, order and visibility", async () => {
    const premium = await saveCategory(null, cat({ name: "Premium", slug: "premium", parentId: categoryId, sortOrder: 2 }));
    const matte = await saveCategory(null, cat({ name: "Matte", slug: "matte", parentId: categoryId, sortOrder: 1, priceFrom: "4.5", priceUnit: "per card" }));
    const foil = await saveCategory(null, cat({ name: "Foil", slug: "foil", parentId: premium }));
    await prisma.product.create({
      data: { sku: "F1", slug: "foil-cards", name: "Foil cards", description: "x", categoryId: foil, basePriceMinor: 900, status: "PUBLISHED" },
    });
    await prisma.product.create({
      data: { sku: "D1", slug: "draft-cards", name: "Draft", description: "x", categoryId: matte, basePriceMinor: 100, status: "DRAFT" },
    });

    let tree = await readCategoryTree();
    const cards = findByPath(tree, ["cards"])!;
    expect(cards.children.map((c) => c.slug)).toEqual(["matte", "premium"]);
    expect(cards.productCount).toBe(1); // published products in the whole subtree; drafts are not counted
    expect(findByPath(tree, ["cards", "premium", "foil"])).toMatchObject({ path: ["cards", "premium", "foil"], depth: 2, productCount: 1 });
    expect(findByPath(tree, ["cards", "matte"])).toMatchObject({ priceFromMinor: 450, priceUnit: "per card" });

    await moveCategory(premium, "up");
    tree = await readCategoryTree();
    expect(findByPath(tree, ["cards"])!.children.map((c) => c.slug)).toEqual(["premium", "matte"]);

    // Hiding a category hides everything inside it.
    await setCategoryVisibility(premium, false);
    tree = await readCategoryTree();
    expect(findByPath(tree, ["cards", "premium"])).toBeNull();
    expect(findByPath(tree, ["cards"])!.productCount).toBe(0);
  });

  it("stores category images as WebP with a descriptive file name", async () => {
    const id = await saveCategory(null, cat({ name: "3D Sign Board", slug: "3d-sign-board" }));
    await setCategoryImage(id, PNG, "Illuminated 3D sign board");
    const category = await prisma.category.findUniqueOrThrow({ where: { id } });
    expect(category.imageKey).toMatch(/^categories\/3d-sign-board-[0-9a-f]{6}\.webp$/);
    expect(category.imageAlt).toBe("Illuminated 3D sign board");
    const bytes = await sharp(resolveLocal(category.imageKey!)).metadata();
    expect(bytes.format).toBe("webp");
    await rejects(setCategoryImage(id, new TextEncoder().encode("<svg/>")), "image", /JPG, PNG or WebP/);
  });
});

describe("admin bootstrap", () => {
  it("makes the first ADMIN_EMAILS account an admin, and nobody after that", async () => {
    process.env.ADMIN_EMAILS = "owner@mixprint.pk";
    try {
      expect((await registerUser({ name: "Owner", email: "owner@mixprint.pk", password: "password123", phone: undefined })).role).toBe("ADMIN");
      await prisma.user.update({ where: { email: "owner@mixprint.pk" }, data: { email: "renamed@mixprint.pk" } });
      expect((await registerUser({ name: "Late", email: "owner@mixprint.pk", password: "password123", phone: undefined })).role).toBe("CUSTOMER");
    } finally {
      delete process.env.ADMIN_EMAILS;
    }
  });
});
