import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CartQuantityForm } from "@/components/cart-quantity-form";
import { removeCartItemAction } from "@/app/actions/cart";
import { getCurrentCart } from "@/lib/cart/session";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <Suspense fallback={<div className="card mt-6 h-64 animate-pulse" />}>
        <CartContents />
      </Suspense>
    </div>
  );
}

async function CartContents() {
  const cart = await getCurrentCart();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/products" className="btn-primary mt-4">
          Browse products
        </Link>
      </div>
    );
  }

  const hasProblems = cart.lines.some((l) => l.problem);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <ul className="space-y-4 lg:col-span-2" data-testid="cart-lines">
        {cart.lines.map((line) => (
          <li key={line.id} className="card flex gap-4 p-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-background">
              {line.image && (
                <Image
                  src={line.image.url}
                  alt={line.image.alt}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized={line.image.url.endsWith(".svg")}
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex justify-between gap-4">
                <div>
                  <Link href={`/products/${line.productSlug}`} className="font-semibold hover:text-brand">
                    {line.productName}
                  </Link>
                  <p className="text-sm text-muted">
                    {line.selection.map((s) => `${s.option}: ${s.value}`).join(" · ")}
                  </p>
                  {line.notes && <p className="mt-1 text-sm italic text-muted">“{line.notes}”</p>}
                </div>
                <p className="text-right font-bold" data-testid="line-total">
                  {formatPKR(line.lineTotalMinor)}
                  <span className="block text-xs font-normal text-muted">{formatPKR(line.unitPriceMinor)} each</span>
                </p>
              </div>
              {line.problem && (
                <p className="field-error" role="alert">
                  {line.problem}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-4">
                <CartQuantityForm
                  itemId={line.id}
                  quantity={line.quantity}
                  min={line.minQuantity}
                  step={line.quantityStep}
                />
                <form action={removeCartItemAction}>
                  <input type="hidden" name="itemId" value={line.id} />
                  <button className="text-sm text-muted underline hover:text-red-600">Remove</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="card h-fit p-5">
        <h2 className="font-bold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-semibold" data-testid="cart-subtotal">
              {formatPKR(cart.subtotalMinor)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>
        <button className="btn-primary mt-5 w-full" disabled title="Checkout arrives in the next stage">
          Checkout (coming next)
        </button>
        {hasProblems && <p className="field-error">Resolve the highlighted items before checkout.</p>}
        <p className="mt-3 text-xs text-muted">Pay with JazzCash, Easypaisa, bank transfer or cash on delivery.</p>
      </aside>
    </div>
  );
}
