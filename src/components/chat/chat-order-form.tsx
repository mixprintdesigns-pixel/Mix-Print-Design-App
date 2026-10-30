"use client";

import { useEffect, useState } from "react";

type ChatProduct = { id: string; name: string; minQuantity: number; fromMinor: number; category: string };
const pkr = (minor: number) => `PKR ${Math.round(minor / 100).toLocaleString("en-PK")}`;

/** Order form inside the chat: product, quantity, name, phone, requirements, then confirm. */
export function ChatOrderForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [products, setProducts] = useState<ChatProduct[] | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requirements, setRequirements] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/chat/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);
  const product = products?.find((p) => p.id === productId);

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: quantity || product?.minQuantity || 1, name, phone, email, requirements }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The order could not be placed. Please try again or use WhatsApp.");
        setConfirming(false);
        return;
      }
      onDone(
        `Thank you, ${name.split(" ")[0]}! Your order **${data.number}** is received (Pending). Estimated total ${pkr(data.totalMinor)}; ` +
          `we will confirm the final price and details on WhatsApp. Payment: 50% advance before work starts, 50% after the work is complete. ` +
          `Track your order at [/track](/track?order=${data.number}).`,
      );
    } catch {
      setError("Could not connect. Please try again or use WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  if (confirming && product) {
    return (
      <div className="space-y-2 rounded-xl bg-background p-3 text-sm" data-testid="chat-order-confirm">
        <p className="font-semibold">Please confirm your order</p>
        <ul className="space-y-0.5 text-xs">
          <li>
            {product.name} × {quantity || product.minQuantity}
          </li>
          <li>
            {name} · {phone}
            {email ? ` · ${email}` : ""}
          </li>
          <li>{requirements}</li>
        </ul>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={place}>
            {busy ? "Placing…" : "Confirm order"}
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirming(false)}>
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-2 rounded-xl bg-background p-3 text-sm"
      aria-label="Place an order"
      onSubmit={(e) => {
        e.preventDefault();
        if (!product) return setError("Choose a product.");
        if (name.trim().length < 2 || phone.trim().length < 7 || requirements.trim().length < 3) {
          return setError("Please fill in your name, phone and requirements.");
        }
        setError(null);
        setConfirming(true);
      }}
    >
      <p className="font-semibold">Place an order</p>
      <label className="block">
        <span className="text-xs text-muted">Product</span>
        <select className="input py-1.5 text-xs" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
          <option value="">{products === null ? "Loading…" : "Choose a product"}</option>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.category}) – from {pkr(p.fromMinor)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-muted">Quantity{product ? ` (minimum ${product.minQuantity})` : ""}</span>
        <input className="input py-1.5 text-xs" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} aria-label="Quantity" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <input className="input py-1.5 text-xs" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
        <input className="input py-1.5 text-xs" placeholder="Phone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone / WhatsApp" />
      </div>
      <input className="input py-1.5 text-xs" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email (optional)" />
      <textarea
        className="input py-1.5 text-xs"
        rows={2}
        placeholder="Requirements: size, colours, deadline…"
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
        aria-label="Requirements"
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary px-3 py-1.5 text-xs">Review order</button>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
