import "server-only";
import { prisma } from "@/lib/db";
import { amountReceived, recordedTotals } from "./payments";
import { NOT_SALES_STATUSES, phoneDigits } from "./shared";

// Customers: registered customer accounts plus the people on staff-recorded (WhatsApp / chat) orders,
// grouped into one row per person. Read-only except for the internal notes.

/** One key per person: their account, else their phone number, else their email. */
export function customerKeyFor(order: { id: string; userId: string | null; customerPhone: string | null; customerEmail: string | null }): string {
  if (order.userId) return `u:${order.userId}`;
  const digits = phoneDigits(order.customerPhone);
  if (digits.length >= 7) return `p:${digits}`;
  if (order.customerEmail) return `e:${order.customerEmail.trim().toLowerCase()}`;
  return `o:${order.id}`;
}

export function isCustomerKey(key: string): boolean {
  return /^[upeo]:[^\s]{1,300}$/.test(key);
}

export type CustomerSummary = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  orderCount: number;
  totalOrderedMinor: number;
  totalPaidMinor: number;
  lastOrderAt: Date | null;
};

const orderSelect = {
  id: true,
  number: true,
  status: true,
  placedAt: true,
  totalMinor: true,
  amountPaidMinor: true,
  source: true,
  userId: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  user: { select: { name: true, email: true, phone: true } },
  items: { select: { productName: true, quantity: true } },
} as const;

async function loadCustomers() {
  const [users, orders] = await Promise.all([
    prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, name: true, email: true, phone: true, createdAt: true } }),
    prisma.order.findMany({ orderBy: { placedAt: "desc" }, take: 5000, select: orderSelect }),
  ]);
  const recorded = await recordedTotals(orders.map((o) => o.id));
  const map = new Map<string, CustomerSummary>();

  for (const u of users) {
    map.set(`u:${u.id}`, {
      key: `u:${u.id}`,
      name: u.name,
      phone: u.phone,
      email: u.email,
      hasAccount: true,
      orderCount: 0,
      totalOrderedMinor: 0,
      totalPaidMinor: 0,
      lastOrderAt: null,
    });
  }
  for (const o of orders) {
    const key = customerKeyFor(o);
    const row =
      map.get(key) ??
      ({
        key,
        name: o.customerName ?? o.user?.name ?? "Customer",
        phone: o.customerPhone ?? o.user?.phone ?? null,
        email: o.customerEmail ?? o.user?.email ?? null,
        hasAccount: Boolean(o.userId),
        orderCount: 0,
        totalOrderedMinor: 0,
        totalPaidMinor: 0,
        lastOrderAt: null,
      } satisfies CustomerSummary);
    row.phone ??= o.customerPhone;
    row.email ??= o.customerEmail;
    row.orderCount += 1;
    row.lastOrderAt = row.lastOrderAt && row.lastOrderAt > o.placedAt ? row.lastOrderAt : o.placedAt;
    if (!(NOT_SALES_STATUSES as readonly string[]).includes(o.status)) {
      row.totalOrderedMinor += o.totalMinor;
      row.totalPaidMinor += amountReceived(o, recorded.get(o.id) ?? 0);
    }
    map.set(key, row);
  }
  return { customers: [...map.values()], orders, recorded };
}

/** All customers, newest order first, optionally filtered by name, phone or email. */
export async function listCustomers(query?: string): Promise<CustomerSummary[]> {
  const { customers } = await loadCustomers();
  const q = query?.trim().toLowerCase();
  const qDigits = q?.replace(/\D/g, "") ?? "";
  const matches = (c: CustomerSummary) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.email ?? "").toLowerCase().includes(q) ||
    (qDigits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(qDigits.replace(/^0/, "")));
  return customers
    .filter(matches)
    .sort((a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0) || a.name.localeCompare(b.name));
}

export async function getCustomer(key: string) {
  if (!isCustomerKey(key)) return null;
  const { customers, orders, recorded } = await loadCustomers();
  const summary = customers.find((c) => c.key === key);
  if (!summary) return null;
  const note = await prisma.customerNote.findUnique({ where: { customerKey: key } });
  return {
    ...summary,
    note: note?.note ?? "",
    noteUpdatedAt: note?.updatedAt ?? null,
    orders: orders
      .filter((o) => customerKeyFor(o) === key)
      .map((o) => {
        const received = amountReceived(o, recorded.get(o.id) ?? 0);
        return { ...o, receivedMinor: received, balanceMinor: Math.max(0, o.totalMinor - received) };
      }),
  };
}

export async function saveCustomerNote(key: string, note: string) {
  if (!isCustomerKey(key)) throw new Error("Unknown customer");
  const text = note.slice(0, 5000);
  return prisma.customerNote.upsert({ where: { customerKey: key }, create: { customerKey: key, note: text }, update: { note: text } });
}
