import "server-only";
import { prisma } from "@/lib/db";
import { listOrderPayments } from "./payments";
import { NOT_SALES_STATUSES, TIME_ZONE } from "./shared";

// Reports: sales by day and month (Pakistan time), top products, top affiliates and unpaid balances.
// Sales are order totals; cancelled and refunded orders are left out.

export type SalesRow = { period: string; orders: number; salesMinor: number };

const excluded = [...NOT_SALES_STATUSES] as string[];

/** Sales per day for the last `days` days, by the date in Pakistan. Days without orders are included as zero. */
export async function salesByDay(days = 30, now = new Date()): Promise<SalesRow[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ period: string; orders: bigint; sales: bigint | null }[]>`
    SELECT to_char(("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS period,
           count(*) AS orders, sum("totalMinor") AS sales
    FROM "Order"
    WHERE "placedAt" >= ${since} AND status::text <> ALL(${excluded})
    GROUP BY 1`;
  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  return Array.from({ length: days }, (_, i) => {
    const period = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
    const r = byPeriod.get(period);
    return { period, orders: Number(r?.orders ?? 0), salesMinor: Number(r?.sales ?? 0) };
  });
}

/** Sales per month for the last `months` months (Pakistan time), oldest first. */
export async function salesByMonth(months = 12, now = new Date()): Promise<SalesRow[]> {
  const rows = await prisma.$queryRaw<{ period: string; orders: bigint; sales: bigint | null }[]>`
    SELECT to_char(("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM') AS period,
           count(*) AS orders, sum("totalMinor") AS sales
    FROM "Order"
    WHERE status::text <> ALL(${excluded})
    GROUP BY 1`;
  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  const [year, month] = now.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }).split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (months - 1 - i), 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = byPeriod.get(period);
    return { period, orders: Number(r?.orders ?? 0), salesMinor: Number(r?.sales ?? 0) };
  });
}

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PK", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function topProducts(limit = 10) {
  const rows = await prisma.orderItem.groupBy({
    by: ["productName"],
    where: { order: { status: { notIn: [...NOT_SALES_STATUSES] } } },
    _sum: { lineTotalMinor: true, quantity: true },
    _count: { orderId: true },
    orderBy: { _sum: { lineTotalMinor: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ name: r.productName, salesMinor: r._sum.lineTotalMinor ?? 0, quantity: r._sum.quantity ?? 0, orders: r._count.orderId }));
}

export async function topAffiliates(limit = 10) {
  const rows = await prisma.affiliateCommission.groupBy({
    by: ["affiliateId"],
    where: { status: { not: "REVERSED" } },
    _sum: { amountMinor: true, baseAmountMinor: true },
    _count: { orderId: true },
    orderBy: { _sum: { baseAmountMinor: "desc" } },
    take: limit,
  });
  const affiliates = await prisma.affiliate.findMany({
    where: { id: { in: rows.map((r) => r.affiliateId) } },
    select: { id: true, code: true, user: { select: { name: true } } },
  });
  return rows.map((r) => {
    const a = affiliates.find((x) => x.id === r.affiliateId);
    return {
      code: a?.code ?? "—",
      name: a?.user.name ?? "—",
      orders: r._count.orderId,
      salesMinor: r._sum.baseAmountMinor ?? 0,
      commissionMinor: r._sum.amountMinor ?? 0,
    };
  });
}

/** Orders that still owe money, largest balance first. */
export async function unpaidBalances() {
  const rows = (await listOrderPayments(undefined, 1000)).filter((o) => o.balanceMinor > 0);
  return rows.sort((a, b) => b.balanceMinor - a.balanceMinor);
}
