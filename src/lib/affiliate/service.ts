import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AffiliateStatus, OrderStatus, Prisma } from "@/generated/prisma/client";
import { calculateCommission, normalizeCode } from "./commission";
import type { PayoutMethodValue } from "./validation";

/** A rule the user broke; the message is safe to show. */
export class AffiliateError extends Error {
  constructor(
    message: string,
    public field = "_form",
  ) {
    super(message);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getAffiliateSettings() {
  return prisma.affiliateSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}
export type AffiliateSettings = Awaited<ReturnType<typeof getAffiliateSettings>>;

export async function updateAffiliateSettings(data: {
  defaultRateBps: number;
  cookieDays: number;
  minWithdrawalMinor: number;
  holdDays: number;
  autoApprove: boolean;
}) {
  return prisma.affiliateSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

// ─── Joining ─────────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

async function uniqueCode(name: string): Promise<string> {
  const prefix = name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6) || "MIX";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const code = `${prefix}${suffix}`;
    if (!(await prisma.affiliate.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate a unique affiliate code");
}

type Payout = { payoutMethod: PayoutMethodValue; payoutAccount: string; payoutAccountName: string };

export async function applyAsAffiliate(
  userId: string,
  input: Payout & { website: string | null; promotionPlan: string },
) {
  const [user, existing, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    prisma.affiliate.findUnique({ where: { userId } }),
    getAffiliateSettings(),
  ]);
  const status: AffiliateStatus = settings.autoApprove ? "APPROVED" : "PENDING";
  const data = { ...input, status, adminNote: null, approvedAt: status === "APPROVED" ? new Date() : null };

  if (existing) {
    // Only rejected applicants may apply again.
    if (existing.status !== "REJECTED") throw new AffiliateError("You have already joined the affiliate program.");
    return prisma.affiliate.update({ where: { id: existing.id }, data });
  }
  return prisma.affiliate.create({ data: { ...data, userId, code: await uniqueCode(user.name) } });
}

export async function updatePayoutDetails(userId: string, input: Payout) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) throw new AffiliateError("Join the affiliate program first.");
  return prisma.affiliate.update({ where: { id: affiliate.id }, data: input });
}

/** Pre-fills the wallet number on the join form. */
export async function getUserPhone(userId: string): Promise<string | null> {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }))?.phone ?? null;
}

export async function getAffiliateForUser(userId: string) {
  return prisma.affiliate.findUnique({ where: { userId } });
}

// ─── Referral clicks ─────────────────────────────────────────────────────────

const CLICK_DEDUPE_MS = 30 * 60 * 1000;

/** IPs are stored only as a keyed hash: enough to spot repeat clicks, useless if leaked. */
export function hashIp(ip: string): string {
  const secret = process.env.AFFILIATE_IP_SECRET ?? process.env.APP_SECRET ?? "mixprint-affiliate";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** Approved affiliate for a referral code, or null. */
export async function findActiveAffiliate(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { code: normalized } });
  return affiliate?.status === "APPROVED" ? affiliate : null;
}

/**
 * Records a click on a referral link. Repeat clicks from the same IP within 30 minutes count once.
 * Returns the affiliate so the caller can set the referral cookie, or null for unknown/inactive codes.
 */
export async function recordClick(
  code: string,
  visit: { landingPath: string; referrer?: string | null; ip?: string | null },
  now = new Date(),
) {
  const affiliate = await findActiveAffiliate(code);
  if (!affiliate) return null;
  const ipHash = visit.ip ? hashIp(visit.ip) : null;
  const recent =
    ipHash &&
    (await prisma.affiliateClick.findFirst({
      where: { affiliateId: affiliate.id, ipHash, createdAt: { gte: new Date(now.getTime() - CLICK_DEDUPE_MS) } },
      select: { id: true },
    }));
  if (!recent) {
    await prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        landingPath: visit.landingPath.slice(0, 300),
        referrer: visit.referrer?.slice(0, 300) || null,
        ipHash,
        createdAt: now,
      },
    });
  }
  return affiliate;
}

// ─── Commissions (called by checkout and order management) ──────────────────

/**
 * Attributes an order to the affiliate behind `referralCode` and creates a PENDING commission.
 * Call once when an order is placed. Safe to call twice (returns the existing commission).
 * Returns null when there is no valid referral, or when affiliates refer themselves.
 */
export async function createCommissionForOrder(orderId: string, referralCode: string | null | undefined) {
  const existing = await prisma.affiliateCommission.findUnique({ where: { orderId } });
  if (existing) return existing;
  if (!referralCode) return null;

  const [affiliate, order, settings] = await Promise.all([
    findActiveAffiliate(referralCode),
    prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { affiliateCommissionBps: true, affiliateCommissionMinor: true } } } } },
    }),
    getAffiliateSettings(),
  ]);
  if (!affiliate || affiliate.userId === order.userId) return null;

  const result = calculateCommission(
    order.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      lineTotalMinor: i.lineTotalMinor,
      productRateBps: i.product?.affiliateCommissionBps ?? null,
      productFixedMinor: i.product?.affiliateCommissionMinor ?? null,
    })),
    { affiliateRateBps: affiliate.commissionRateBps, defaultRateBps: settings.defaultRateBps },
    order.discountMinor,
  );

  return prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { affiliateId: affiliate.id } });
    return tx.affiliateCommission.create({
      data: {
        affiliateId: affiliate.id,
        orderId: order.id,
        baseAmountMinor: result.baseAmountMinor,
        amountMinor: result.amountMinor,
        breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

/** Keeps commissions in step with the order: cancelled or refunded orders do not earn. */
export async function onOrderStatusChanged(orderId: string, status: OrderStatus): Promise<void> {
  if (status !== "CANCELLED" && status !== "REFUNDED") return;
  const commission = await prisma.affiliateCommission.findUnique({ where: { orderId } });
  if (!commission) return;
  await reverseCommission(commission.id, `Order ${status.toLowerCase()}`);
}

export async function reverseCommission(commissionId: string, note: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await tx.affiliateCommission.findUniqueOrThrow({ where: { id: commissionId }, include: { withdrawal: true } });
    if (c.status === "REVERSED") return;
    if (c.status === "PAID") {
      // Money has already gone out; flag it for manual recovery instead of silently changing history.
      await tx.affiliateCommission.update({ where: { id: c.id }, data: { note: `${note} after payout — recover manually` } });
      return;
    }
    if (c.withdrawal?.status === "REQUESTED") {
      await tx.affiliateWithdrawal.update({
        where: { id: c.withdrawal.id },
        data: { amountMinor: { decrement: c.amountMinor } },
      });
    }
    await tx.affiliateCommission.update({
      where: { id: c.id },
      data: { status: "REVERSED", reversedAt: new Date(), note, withdrawalId: null },
    });
  });
}

export async function approveCommission(commissionId: string): Promise<void> {
  const c = await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: commissionId } });
  if (c.status !== "PENDING") throw new AffiliateError("Only pending commissions can be approved.");
  await prisma.affiliateCommission.update({ where: { id: c.id }, data: { status: "APPROVED", approvedAt: new Date() } });
}

/**
 * Approves PENDING commissions whose order was delivered at least `holdDays` ago
 * (the refund window). Run from the admin screen or a scheduled job.
 */
export async function approveDueCommissions(now = new Date()): Promise<number> {
  const { holdDays } = await getAffiliateSettings();
  const cutoff = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);
  const due = await prisma.affiliateCommission.findMany({
    where: {
      status: "PENDING",
      order: { status: "DELIVERED", statusEvents: { some: { status: "DELIVERED", createdAt: { lte: cutoff } } } },
    },
    select: { id: true },
  });
  if (due.length === 0) return 0;
  const { count } = await prisma.affiliateCommission.updateMany({
    where: { id: { in: due.map((d) => d.id) }, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: now },
  });
  return count;
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

/** Requests payout of the whole available balance (approved commissions not yet withdrawn). */
export async function requestWithdrawal(userId: string) {
  const settings = await getAffiliateSettings();
  return prisma.$transaction(
    async (tx) => {
      const affiliate = await tx.affiliate.findUnique({ where: { userId } });
      if (!affiliate) throw new AffiliateError("Join the affiliate program first.");
      if (affiliate.status !== "APPROVED" && affiliate.status !== "SUSPENDED") {
        throw new AffiliateError("Your affiliate account is not active.");
      }
      if (!affiliate.payoutMethod || !affiliate.payoutAccount || !affiliate.payoutAccountName) {
        throw new AffiliateError("Add your payout details first.");
      }
      const open = await tx.affiliateWithdrawal.count({ where: { affiliateId: affiliate.id, status: "REQUESTED" } });
      if (open > 0) throw new AffiliateError("You already have a withdrawal being processed.");

      const available = await tx.affiliateCommission.findMany({
        where: { affiliateId: affiliate.id, status: "APPROVED", withdrawalId: null },
        select: { id: true, amountMinor: true },
      });
      const amount = available.reduce((s, c) => s + c.amountMinor, 0);
      if (amount <= 0) throw new AffiliateError("You have no available balance yet.");
      if (amount < settings.minWithdrawalMinor) {
        throw new AffiliateError(`The minimum withdrawal is PKR ${(settings.minWithdrawalMinor / 100).toLocaleString("en-PK")}.`);
      }

      const withdrawal = await tx.affiliateWithdrawal.create({
        data: {
          affiliateId: affiliate.id,
          amountMinor: amount,
          method: affiliate.payoutMethod,
          account: affiliate.payoutAccount,
          accountName: affiliate.payoutAccountName,
        },
      });
      const linked = await tx.affiliateCommission.updateMany({
        where: { id: { in: available.map((c) => c.id) }, status: "APPROVED", withdrawalId: null },
        data: { withdrawalId: withdrawal.id },
      });
      if (linked.count !== available.length) throw new AffiliateError("Your balance changed. Please try again.");
      return withdrawal;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function markWithdrawalPaid(
  withdrawalId: string,
  transactionRef: string,
  details: { paidAt?: Date; method?: PayoutMethodValue } = {},
): Promise<void> {
  const ref = transactionRef.trim();
  if (details.paidAt && (Number.isNaN(details.paidAt.getTime()) || details.paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)) {
    throw new AffiliateError("Enter the date the payout was sent (not in the future).", "paidAt");
  }
  if (ref.length < 3) throw new AffiliateError("Enter the JazzCash / Easypaisa / bank transaction reference.", "transactionRef");
  await prisma.$transaction(async (tx) => {
    const w = await tx.affiliateWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (w.status !== "REQUESTED") throw new AffiliateError("This withdrawal has already been processed.");
    const now = details.paidAt ?? new Date();
    await tx.affiliateWithdrawal.update({
      where: { id: w.id },
      data: { status: "PAID", transactionRef: ref.slice(0, 100), processedAt: now, paidMethod: details.method ?? w.method },
    });
    await tx.affiliateCommission.updateMany({
      where: { withdrawalId: w.id, status: "APPROVED" },
      data: { status: "PAID", paidAt: now },
    });
  });
}

export async function rejectWithdrawal(withdrawalId: string, note: string): Promise<void> {
  const reason = note.trim();
  if (reason.length < 3) throw new AffiliateError("Tell the affiliate why the withdrawal was rejected.", "adminNote");
  await prisma.$transaction(async (tx) => {
    const w = await tx.affiliateWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (w.status !== "REQUESTED") throw new AffiliateError("This withdrawal has already been processed.");
    await tx.affiliateWithdrawal.update({
      where: { id: w.id },
      data: { status: "REJECTED", adminNote: reason.slice(0, 500), processedAt: new Date() },
    });
    // The commissions return to the available balance.
    await tx.affiliateCommission.updateMany({ where: { withdrawalId: w.id }, data: { withdrawalId: null } });
  });
}

// ─── Admin: affiliates ───────────────────────────────────────────────────────

export async function setAffiliateStatus(affiliateId: string, status: AffiliateStatus, note?: string) {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
  return prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      status,
      adminNote: status === "APPROVED" ? null : note?.trim().slice(0, 500) || null,
      approvedAt: status === "APPROVED" ? (affiliate.approvedAt ?? new Date()) : affiliate.approvedAt,
    },
  });
}

export async function setAffiliateRate(affiliateId: string, rateBps: number | null) {
  if (rateBps !== null && (rateBps < 0 || rateBps > 5000)) throw new AffiliateError("Rate must be between 0 and 50%.", "rate");
  return prisma.affiliate.update({ where: { id: affiliateId }, data: { commissionRateBps: rateBps } });
}

// ─── Reporting ───────────────────────────────────────────────────────────────

async function sumBy(where: Prisma.AffiliateCommissionWhereInput): Promise<number> {
  return (await prisma.affiliateCommission.aggregate({ where, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
}

export async function getAffiliateStats(affiliateId: string, now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [clicks, clicks30, orders, pending, available, processing, paid, salesAgg] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateClick.count({ where: { affiliateId, createdAt: { gte: since30 } } }),
    prisma.affiliateCommission.count({ where: { affiliateId, status: { not: "REVERSED" } } }),
    sumBy({ affiliateId, status: "PENDING" }),
    sumBy({ affiliateId, status: "APPROVED", withdrawalId: null }),
    sumBy({ affiliateId, status: "APPROVED", withdrawal: { status: "REQUESTED" } }),
    sumBy({ affiliateId, status: "PAID" }),
    prisma.affiliateCommission.aggregate({
      where: { affiliateId, status: { not: "REVERSED" } },
      _sum: { baseAmountMinor: true },
    }),
  ]);
  return {
    clicks,
    clicks30,
    orders,
    conversionRate: clicks > 0 ? orders / clicks : 0,
    salesMinor: salesAgg._sum.baseAmountMinor ?? 0,
    pendingMinor: pending,
    availableMinor: available,
    processingMinor: processing,
    paidMinor: paid,
  };
}
export type AffiliateStats = Awaited<ReturnType<typeof getAffiliateStats>>;

export async function listAffiliateCommissions(affiliateId: string, take = 50) {
  return prisma.affiliateCommission.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amountMinor: true,
      baseAmountMinor: true,
      status: true,
      note: true,
      createdAt: true,
      order: { select: { number: true, placedAt: true } },
    },
  });
}

export async function listAffiliateWithdrawals(affiliateId: string) {
  return prisma.affiliateWithdrawal.findMany({ where: { affiliateId }, orderBy: { requestedAt: "desc" }, take: 50 });
}

export async function listAffiliatesForAdmin(filter: { status?: string; q?: string }) {
  const statuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
  const q = filter.q?.trim();
  const affiliates = await prisma.affiliate.findMany({
    where: {
      ...(statuses.includes(filter.status ?? "") ? { status: filter.status as AffiliateStatus } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true, email: true, phone: true } }, _count: { select: { clicks: true } } },
  });
  const totals = await prisma.affiliateCommission.groupBy({
    by: ["affiliateId", "status"],
    where: { affiliateId: { in: affiliates.map((a) => a.id) } },
    _sum: { amountMinor: true },
    _count: true,
  });
  return affiliates.map((a) => {
    const mine = totals.filter((t) => t.affiliateId === a.id);
    const sum = (status: string) => mine.find((t) => t.status === status)?._sum.amountMinor ?? 0;
    return {
      ...a,
      orders: mine.filter((t) => t.status !== "REVERSED").reduce((s, t) => s + t._count, 0),
      earnedMinor: sum("PENDING") + sum("APPROVED") + sum("PAID"),
      paidMinor: sum("PAID"),
    };
  });
}

export async function listCommissionsForAdmin(filter: { status?: string }) {
  const statuses = ["PENDING", "APPROVED", "PAID", "REVERSED"];
  return prisma.affiliateCommission.findMany({
    where: statuses.includes(filter.status ?? "") ? { status: filter.status as "PENDING" } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      affiliate: { select: { code: true, user: { select: { name: true } } } },
      order: { select: { number: true, status: true, totalMinor: true } },
      withdrawal: { select: { status: true } },
    },
  });
}

export async function listWithdrawalsForAdmin(filter: { status?: string }) {
  const statuses = ["REQUESTED", "PAID", "REJECTED"];
  return prisma.affiliateWithdrawal.findMany({
    where: statuses.includes(filter.status ?? "") ? { status: filter.status as "REQUESTED" } : {},
    orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
    take: 200,
    include: { affiliate: { select: { code: true, user: { select: { name: true, email: true } } } }, _count: { select: { commissions: true } } },
  });
}

export async function getProgramTotals() {
  const [affiliates, pendingApplications, clicks, owed, paid, requested] = await Promise.all([
    prisma.affiliate.count({ where: { status: "APPROVED" } }),
    prisma.affiliate.count({ where: { status: "PENDING" } }),
    prisma.affiliateClick.count(),
    sumBy({ status: { in: ["PENDING", "APPROVED"] } }),
    sumBy({ status: "PAID" }),
    prisma.affiliateWithdrawal.aggregate({ where: { status: "REQUESTED" }, _sum: { amountMinor: true }, _count: true }),
  ]);
  return {
    affiliates,
    pendingApplications,
    clicks,
    owedMinor: owed,
    paidMinor: paid,
    requestedCount: requested._count,
    requestedMinor: requested._sum.amountMinor ?? 0,
  };
}
