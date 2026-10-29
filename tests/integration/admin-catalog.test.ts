import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addProductImage,
  AdminInputError,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  reorderProductImages,
  saveCategory,
  saveProduct,
} from "@/lib/admin/catalog-service";
import { productInputSchema, type ProductInput } from "@/lib/admin/product-input";
import { addCartItem, createGuestCart, getCartView } from "@/lib/cart/service";
import { registerUser } from "@/lib/auth/service";
import { resolveLocal } from "@/lib/storage";
import { resetDatabase } from "../support/db";
import { validProduct } from "../support/fixtures";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let categoryId: string;

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
  categoryId = await saveCategory(null, { name: "Cards", slug: "cards", description: null, parentId: null, sortOrder: 0 });
});

describe("saving products", () => {
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
    const child = await saveCategory(null, { name: "Premium", slug: "premium", description: null, parentId: categoryId, sortOrder: 0 });
    const grandchild = await saveCategory(null, { name: "Foil", slug: "foil", description: null, parentId: child, sortOrder: 0 });
    await rejects(
      saveCategory(categoryId, { name: "Cards", slug: "cards", description: null, parentId: grandchild, sortOrder: 0 }),
      "parentId",
      /inside itself/,
    );
    await rejects(saveCategory(null, { name: "Dup", slug: "cards", description: null, parentId: null, sortOrder: 0 }), "slug", /slug/);
  });

  it("refuses to delete categories that still have products or subcategories", async () => {
    await saveProduct(null, input());
    await rejects(deleteCategory(categoryId), "_form", /products/);
    const parent = await saveCategory(null, { name: "Parent", slug: "parent", description: null, parentId: null, sortOrder: 0 });
    await saveCategory(null, { name: "Child", slug: "child", description: null, parentId: parent, sortOrder: 0 });
    await rejects(deleteCategory(parent), "_form", /subcategories/);
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
