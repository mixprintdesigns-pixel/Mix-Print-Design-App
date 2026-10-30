import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { formatPKR } from "@/lib/money";
import { balanceDue, findOrderForTracking, ORDER_FLOW, PAYMENT_TERMS, STATUS_LABELS } from "@/lib/orders/manual";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <p className="mt-2 text-muted">Enter your order number and the phone number you gave us.</p>
      <Suspense fallback={<div className="card mt-6 h-40 animate-pulse" />}>
        <Tracker searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Tracker({ searchParams }: { searchParams: PageProps<"/track">["searchParams"] }) {
  const params = await searchParams;
  const number = typeof params.order === "string" ? params.order.slice(0, 20) : "";
  const phone = typeof params.phone === "string" ? params.phone.slice(0, 30) : "";
  const order = number && phone ? await findOrderForTracking(number, phone) : null;
  const step = order ? ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]) : -1;

  return (
    <>
      <form action="/track" className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="label">Order number</span>
          <input name="order" className="input uppercase" defaultValue={number} placeholder="MP-26A1B2C3" required />
        </label>
        <label className="block">
          <span className="label">Phone number</span>
          <input name="phone" type="tel" className="input" defaultValue={phone} placeholder="0300 1234567" required />
        </label>
        <button className="btn-primary">Track</button>
      </form>

      {number && phone && !order && (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" role="alert">
          We could not find an order with that number and phone. Please check both, or message us on WhatsApp.
        </p>
      )}

      {order && (
        <section className="card mt-6 space-y-5 p-5" aria-labelledby="order-heading" data-testid="tracked-order">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="order-heading" className="text-xl font-bold">
              Order {order.number}
            </h2>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand" data-testid="tracked-status">
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-6" aria-label="Order progress">
            {ORDER_FLOW.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? "step" : undefined}
                className={`rounded-lg border p-2 text-center text-xs ${i <= step ? "border-brand bg-brand/10 font-semibold" : "border-border text-muted"}`}
              >
                {STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
          <ul className="text-sm">
            {order.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {item.productName}
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted">Total</dt>
              <dd className="font-bold">{formatPKR(order.totalMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted">Paid</dt>
              <dd className="font-bold">{formatPKR(order.amountPaidMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted">Balance due</dt>
              <dd className="font-bold" data-testid="tracked-balance">
                {formatPKR(balanceDue(order))}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted">Payment terms: {PAYMENT_TERMS}</p>
          {order.workPhotos.length > 0 && (
            <div>
              <h3 className="font-semibold">Your finished work</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {order.workPhotos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg">
                    <Image src={p.url} alt={`Finished work for order ${order.number}`} fill sizes="200px" className="object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
