import "server-only";
import { cookies } from "next/headers";
import { generateToken, hashToken } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countCartLines,
  createGuestCart,
  findGuestCartId,
  findUserCartId,
  getCartView,
  getOrCreateUserCartId,
  mergeGuestCartIntoUser,
  type CartView,
} from "./service";

export const CART_COOKIE = "mp_cart";

async function guestCartId(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token ? findGuestCartId(hashToken(token)) : null;
}

/** Read-only: the cart for this request, if one exists. */
async function currentCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? findUserCartId(user.id) : guestCartId();
}

export async function getCurrentCart(): Promise<CartView | null> {
  const id = await currentCartId();
  return id ? getCartView(id) : null;
}

export async function getCurrentCartCount(): Promise<number> {
  const id = await currentCartId();
  return id ? countCartLines(id) : 0;
}

/** Server Actions only: returns the cart id, creating a cart (and guest cookie) when needed. */
export async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return getOrCreateUserCartId(user.id);

  const existing = await guestCartId();
  if (existing) return existing;

  const token = generateToken();
  const id = await createGuestCart(hashToken(token));
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return id;
}

/** Server Actions only: call right after login or sign-up. */
export async function adoptGuestCart(userId: string): Promise<void> {
  const jar = await cookies();
  const id = await guestCartId();
  if (id) await mergeGuestCartIntoUser(id, userId);
  jar.delete(CART_COOKIE);
}
