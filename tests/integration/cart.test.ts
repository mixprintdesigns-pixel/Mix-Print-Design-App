import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addCartItem,
  CartError,
  createGuestCart,
  getCartView,
  getOrCreateUserCartId,
  mergeGuestCartIntoUser,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/service";
import { createTestProduct, resetDatabase } from "../support/db";

type TestProduct = Awaited<ReturnType<typeof createTestProduct>>;
let product: TestProduct;
let matte: string, gloss: string, single: string, double: string;

async function newUser(email = "sara@example.com") {
  return prisma.user.create({ data: { email, name: "Sara", passwordHash: "x" } });
}

beforeEach(async () => {
  await resetDatabase();
  product = await createTestProduct();
  [matte, gloss] = product.options[0].values.map((v) => v.id);
  [single, double] = product.options[1].values.map((v) => v.id);
});

describe("adding to cart", () => {
  it("prices lines from the database using tiers and options", async () => {
    const cartId = await createGuestCart("guest-hash");
    await addCartItem(cartId, { productId: product.id, quantity: 500, optionValueIds: [gloss, double] });
    const cart = await getCartView(cartId);
    expect(cart.lines).toHaveLength(1);
    // tier 2.50 + gloss 0.50 + double 1.00 = PKR 4.00 × 500
    expect(cart.lines[0]).toMatchObject({ unitPriceMinor: 400, lineTotalMinor: 200_000, problem: null });
    expect(cart.subtotalMinor).toBe(200_000);
  });

  it("merges identical configurations and keeps different ones separate", async () => {
    const cartId = await createGuestCart("guest-hash");
    await addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });
    await addCartItem(cartId, { productId: product.id, quantity: 200, optionValueIds: [single, matte] });
    await addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [gloss, single] });
    const cart = await getCartView(cartId);
    expect(cart.lines.map((l) => l.quantity)).toEqual([300, 100]);
  });

  it("rejects missing, foreign or unknown options", async () => {
    const cartId = await createGuestCart("guest-hash");
    const other = await createTestProduct();
    const otherValue = other.options[0].values[0].id;
    await expect(addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [matte] })).rejects.toThrow(CartError);
    await expect(
      addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [otherValue, single] }),
    ).rejects.toThrow(CartError);
  });

  it("enforces quantity rules and product availability", async () => {
    const cartId = await createGuestCart("guest-hash");
    await expect(addCartItem(cartId, { productId: product.id, quantity: 50, optionValueIds: [matte, single] })).rejects.toThrow(/Minimum/);
    await expect(addCartItem(cartId, { productId: product.id, quantity: 150, optionValueIds: [matte, single] })).rejects.toThrow(/steps/);
    const hidden = await createTestProduct({ isActive: false });
    const ids = hidden.options.map((o) => o.values[0].id);
    await expect(addCartItem(cartId, { productId: hidden.id, quantity: 100, optionValueIds: ids })).rejects.toThrow(/not available/);
  });
});

describe("changing the cart", () => {
  it("updates quantities with validation", async () => {
    const cartId = await createGuestCart("guest-hash");
    await addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });
    const [line] = (await getCartView(cartId)).lines;
    await updateCartItemQuantity(cartId, line.id, 1000);
    expect((await getCartView(cartId)).lines[0]).toMatchObject({ quantity: 1000, unitPriceMinor: 250 });
    await expect(updateCartItemQuantity(cartId, line.id, 0)).rejects.toThrow(CartError);
  });

  it("cannot modify another cart's items", async () => {
    const mine = await createGuestCart("mine");
    const theirs = await createGuestCart("theirs");
    await addCartItem(theirs, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });
    const [line] = (await getCartView(theirs)).lines;

    await removeCartItem(mine, line.id);
    await expect(updateCartItemQuantity(mine, line.id, 200)).rejects.toThrow(/not found/);
    expect((await getCartView(theirs)).lines).toHaveLength(1);

    await removeCartItem(theirs, line.id);
    expect((await getCartView(theirs)).lines).toHaveLength(0);
  });

  it("flags products that were disabled after being added", async () => {
    const cartId = await createGuestCart("guest-hash");
    await addCartItem(cartId, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    const cart = await getCartView(cartId);
    expect(cart.lines[0].problem).toMatch(/no longer available/);
    expect(cart.subtotalMinor).toBe(0);
  });
});

describe("merging a guest cart on login", () => {
  it("adds guest lines to the user's cart and deletes the guest cart", async () => {
    const user = await newUser();
    const userCart = await getOrCreateUserCartId(user.id);
    await addCartItem(userCart, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });

    const guestCart = await createGuestCart("guest-hash");
    await addCartItem(guestCart, { productId: product.id, quantity: 200, optionValueIds: [matte, single] });
    await addCartItem(guestCart, { productId: product.id, quantity: 100, optionValueIds: [gloss, double] });

    await mergeGuestCartIntoUser(guestCart, user.id);

    const cart = await getCartView(userCart);
    expect(cart.lines.map((l) => l.quantity).sort()).toEqual([100, 300]);
    expect(await prisma.cart.findUnique({ where: { id: guestCart } })).toBeNull();
  });

  it("creates the user's cart if they did not have one", async () => {
    const user = await newUser();
    const guestCart = await createGuestCart("guest-hash");
    await addCartItem(guestCart, { productId: product.id, quantity: 100, optionValueIds: [matte, single] });
    await mergeGuestCartIntoUser(guestCart, user.id);
    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id }, include: { items: true } });
    expect(cart.items).toHaveLength(1);
  });
});
