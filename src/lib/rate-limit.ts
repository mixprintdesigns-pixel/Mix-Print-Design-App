import "server-only";
import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limit stored in the database, so it works across serverless instances.
 * Returns whether this request is allowed and records it if so.
 */
export async function rateLimit(key: string, limit: number, windowMs: number, now = new Date()): Promise<{ allowed: boolean }> {
  const since = new Date(now.getTime() - windowMs);
  const used = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (used >= limit) return { allowed: false };
  await prisma.rateLimitHit.create({ data: { key, createdAt: now } });
  // Occasionally clear old rows so the table stays small.
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  }
  return { allowed: true };
}
