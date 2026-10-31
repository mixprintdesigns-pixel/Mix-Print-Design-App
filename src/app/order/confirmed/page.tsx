import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatPKR } from "@/lib/money";
import { getOrderConfirmation } from "@/lib/orders/website-order";

// Shown after "Order now": the order number and a button to continue on WhatsApp (in case it did not open).

export const metadata: Metadata = { title: "Order received", robots: { index: false, follow: false } };

export default function Page({ searchParams }: PageProps<"/order/confirmed">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Suspense fallback={<div className="card h-80 animate-pulse" />}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Confirmation({ searchParams }: { searchParams: PageProps<"/order/confirmed">["searchParams"] }) {
  const { n, t } = await searchParams;
  const order = typeof n === "string" && typeof t === "string" ? await getOrderConfirmation(n, t) : null;
  if (!order) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="mt-2 text-muted">This link is not valid. If you placed an order, message us on WhatsApp with your order number.</p>
        <Link href="/products" className="btn-primary mt-6 inline-flex">
          Browse products
        </Link>
      </div>
    );
  }
  return (
    <div className="card p-6 text-center sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Order received</p>
      <h1 className="mt-2 text-3xl font-bold" data-testid="order-number">
        Order #{order.number}
      </h1>
      <p className="mt-2 text-muted">
        Thank you{order.customerName ? `, ${order.customerName}` : ""}! Your order is saved. Please send it to us on WhatsApp so we can confirm the
        artwork, price and delivery.
      </p>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-left text-sm">
        {order.items.map((i, k) => (
          <p key={k} className="font-semibold">
            {i.quantity} × {i.productName}
          </p>
        ))}
        {order.options.map((o) => (
          <p key={o.option} className="text-muted">
            {o.option}: {o.value}
          </p>
        ))}
        <p className="mt-2 text-lg font-bold" data-testid="order-total">
          Total {formatPKR(order.totalMinor)}
        </p>
        <p className="mt-1 text-xs text-muted">Payment: 50% advance before work starts, 50% after completion, before delivery.</p>
      </div>
      <a
        href={order.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn mt-6 inline-flex bg-green-600 text-white hover:bg-green-700"
        data-testid="continue-whatsapp"
      >
        Continue on WhatsApp
      </a>
      <p className="mt-4 text-sm text-muted">
        Track your order any time on the{" "}
        <Link href="/track" className="font-semibold text-brand">
          order tracking page
        </Link>{" "}
        with your order number and mobile number.
      </p>
    </div>
  );
}
