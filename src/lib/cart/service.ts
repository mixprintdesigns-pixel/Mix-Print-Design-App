import "server-only";
import { prisma } from "@/lib/db";
import { configKey, linePrice, resolveSelection, validateQuantity, type SelectedOption } from "@/lib/pricing";

export class CartError extends Error {}

const productForPricing = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  basePriceMinor: true,
  minQuantity: true,
  quantityStep: true,
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } },
  priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
  options: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, name: true, values: { select: { id: true, label: true, priceDeltaMinor: true } } },
  },
};

export type CartLine = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  image: { url: string; alt: string } | null;
  quantity: number;
  minQuantity: number;
  quantityStep: number;
  selection: SelectedOption[];
  notes: string | null;
  unitPriceMinor: number;
  lineTotalMinor: number;
  /** Set when the product was disabled or its options changed since it was added. */
  problem: string | null;
};

export type CartView = { id: string; lines: CartLine[]; itemCount: number; subtotalMinor: number };

export async function getCartView(cartId: string): Promise<CartView> {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
    include: { product: { select: productForPricing } },
  });

  const lines: CartLine[] = items.map((item) => {
    const p = item.product;
    const resolved = resolveSelection(p.options, item.optionValueIds);
    const selection = resolved.ok ? resolved.selection : [];
    const { unitPriceMinor, lineTotalMinor } = linePrice(p, selection, item.quantity);
    const problem = !p.isActive
      ? "This product is no longer available."
      : !resolved.ok
        ? "Options for this product have changed. Please remove it and add it again."
        : validateQuantity(p, item.quantity);
    return {
      id: item.id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      image: p.images[0] ?? null,
      quantity: item.quantity,
      minQuantity: p.minQuantity,
      quantityStep: p.quantityStep,
      selection,
      notes: item.notes,
      unitPriceMinor,
      lineTotalMinor,
      problem,
    };
  });

  return {
    id: cartId,
    lines,
    itemCount: lines.length,
    subtotalMinor: lines.filter((l) => !l.problem).reduce((sum, l) => sum + l.lineTotalMinor, 0),
  };
}

export async function countCartLines(cartId: string): Promise<number> {
  return prisma.cartItem.count({ where: { cartId } });
}

async function loadSellableProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: productForPricing });
  if (!product || !product.isActive) throw new CartError("This product is not available.");
  return product;
}

/** Adds a configured product. Identical configurations are merged into one line. */
export async function addCartItem(
  cartId: string,
  input: { productId: string; quantity: number; optionValueIds: string[]; notes?: string },
): Promise<void> {
  const product = await loadSellableProduct(input.productId);
  const resolved = resolveSelection(product.options, input.optionValueIds);
  if (!resolved.ok) throw new CartError(resolved.error);

  const key = configKey(input.optionValueIds);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId_configKey: { cartId, productId: product.id, configKey: key } },
  });
  const quantity = (existing?.quantity ?? 0) + input.quantity;
  const quantityError = validateQuantity(product, quantity);
  if (quantityError) throw new CartError(quantityError);

  await prisma.cartItem.upsert({
    where: { cartId_productId_configKey: { cartId, productId: product.id, configKey: key } },
    create: {
      cartId,
      productId: product.id,
      quantity,
      optionValueIds: resolved.selection.map((s) => s.valueId),
      configKey: key,
      notes: input.notes || null,
    },
    update: { quantity, ...(input.notes ? { notes: input.notes } : {}) },
  });
  await prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
}

export async function updateCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<void> {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new CartError("Item not found in your cart.");
  const product = await loadSellableProduct(item.productId);
  const quantityError = validateQuantity(product, quantity);
  if (quantityError) throw new CartError(quantityError);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(cartId: string, itemId: string): Promise<void> {
  // Scoped by cartId so nobody can delete items from another cart by guessing ids.
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
}

export async function findUserCartId(userId: string): Promise<string | null> {
  return (await prisma.cart.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
}

export async function getOrCreateUserCartId(userId: string): Promise<string> {
  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
  return cart.id;
}

export async function findGuestCartId(guestTokenHash: string): Promise<string | null> {
  return (await prisma.cart.findUnique({ where: { guestTokenHash }, select: { id: true } }))?.id ?? null;
}

export async function createGuestCart(guestTokenHash: string): Promise<string> {
  return (await prisma.cart.create({ data: { guestTokenHash }, select: { id: true } })).id;
}

/**
 * Moves a guest cart into the user's cart after login or sign-up.
 * Matching configurations add their quantities; the guest cart is deleted.
 */
export async function mergeGuestCartIntoUser(guestCartId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({ where: { id: guestCartId }, include: { items: true } });
    if (!guest || guest.userId) return;
    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });

    for (const item of guest.items) {
      await tx.cartItem.upsert({
        where: {
          cartId_productId_configKey: { cartId: userCart.id, productId: item.productId, configKey: item.configKey },
        },
        create: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity,
          optionValueIds: item.optionValueIds,
          configKey: item.configKey,
          notes: item.notes,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
