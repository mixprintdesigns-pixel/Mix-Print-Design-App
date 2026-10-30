import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/storage/images";
import { newKey, saveFile } from "@/lib/storage";
import type { DesignJobStatus } from "@/generated/prisma/client";

// Design work: orders that need a design, proof files, and the customer's approval link.

export const DESIGN_STATUSES = ["PENDING", "IN_PROGRESS", "SENT_FOR_APPROVAL", "APPROVED"] as const satisfies readonly DesignJobStatus[];

export const DESIGN_STATUS_LABELS: Record<DesignJobStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SENT_FOR_APPROVAL: "Sent for approval",
  APPROVED: "Approved",
};

export const PROOF_RESPONSE_LABELS = { WAITING: "Waiting for customer", APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested" } as const;

export class DesignWorkError extends Error {}

export function approvalPath(token: string): string {
  return `/design-approval/${token}`;
}

/** Adds an order to the design work list. If it is already there, the existing job is kept unchanged. */
export async function addOrderToDesignWork(orderNumber: string, brief?: string | null) {
  const order = await prisma.order.findUnique({ where: { number: orderNumber.trim().toUpperCase() }, select: { id: true } });
  if (!order) throw new DesignWorkError(`Order ${orderNumber.trim().toUpperCase()} was not found.`);
  const existing = await prisma.designJob.findUnique({ where: { orderId: order.id } });
  if (existing) return { job: existing, created: false };
  const job = await prisma.designJob.create({
    data: { orderId: order.id, brief: brief?.trim() || null, approvalToken: randomBytes(24).toString("base64url") },
  });
  return { job, created: true };
}

export async function setDesignStatus(jobId: string, status: DesignJobStatus) {
  return prisma.designJob.update({ where: { id: jobId }, data: { status } });
}

export async function setDesignBrief(jobId: string, brief: string) {
  return prisma.designJob.update({ where: { id: jobId }, data: { brief: brief.trim() || null } });
}

/** Proof files may be JPG, PNG, WebP or PDF, up to 4 MB. The type is read from the file's first bytes. */
export function checkProofFile(bytes: Uint8Array): { ok: true; type: string; ext: string } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "Proof files must be 4 MB or smaller." };
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return { ok: true, type: "application/pdf", ext: "pdf" };
  const image = checkImage(bytes);
  return image.ok ? image : { ok: false, error: "Use a JPG, PNG, WebP or PDF file." };
}

/** Saves a new proof version and marks the job "Sent for approval". */
export async function addDesignProof(jobId: string, file: { bytes: Uint8Array; name: string }, staffNote?: string | null) {
  const check = checkProofFile(file.bytes);
  if (!check.ok) throw new DesignWorkError(check.error);
  await prisma.designJob.findUniqueOrThrow({ where: { id: jobId }, select: { id: true } });
  const last = await prisma.designProofFile.findFirst({ where: { jobId }, orderBy: { version: "desc" }, select: { version: true } });
  const stored = await saveFile(newKey(`designs/${jobId}`, check.ext), file.bytes, check.type);
  const proof = await prisma.designProofFile.create({
    data: {
      jobId,
      version: (last?.version ?? 0) + 1,
      url: stored.url,
      storageKey: stored.key,
      fileName: file.name.slice(0, 200) || `proof.${check.ext}`,
      mimeType: check.type,
      staffNote: staffNote?.trim() || null,
    },
  });
  await prisma.designJob.update({ where: { id: jobId }, data: { status: "SENT_FOR_APPROVAL" } });
  return proof;
}

const orderSelect = {
  id: true,
  number: true,
  status: true,
  placedAt: true,
  customerName: true,
  customerPhone: true,
  user: { select: { name: true, phone: true } },
  items: { select: { productName: true, quantity: true } },
} as const;

export async function listDesignJobs(status?: DesignJobStatus) {
  const jobs = await prisma.designJob.findMany({ where: status ? { status } : {}, orderBy: { updatedAt: "desc" }, take: 200 });
  const ids = jobs.map((j) => j.id);
  const [orders, proofs] = await Promise.all([
    prisma.order.findMany({ where: { id: { in: jobs.map((j) => j.orderId) } }, select: orderSelect }),
    prisma.designProofFile.findMany({ where: { jobId: { in: ids } }, orderBy: { version: "asc" } }),
  ]);
  return jobs.map((job) => ({
    ...job,
    order: orders.find((o) => o.id === job.orderId) ?? null,
    proofs: proofs.filter((p) => p.jobId === job.id),
  }));
}

/** Recent orders not yet on the design list, offered as suggestions in the "Add order" box. */
export async function ordersWithoutDesignJob(take = 50) {
  const jobOrderIds = (await prisma.designJob.findMany({ select: { orderId: true } })).map((j) => j.orderId);
  return prisma.order.findMany({
    where: { id: { notIn: jobOrderIds }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    orderBy: { placedAt: "desc" },
    take,
    select: { number: true, customerName: true, user: { select: { name: true } } },
  });
}

/** What the customer sees on their approval link. */
export async function getApprovalView(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const job = await prisma.designJob.findUnique({ where: { approvalToken: token } });
  if (!job) return null;
  const [order, proofs] = await Promise.all([
    prisma.order.findUnique({ where: { id: job.orderId }, select: { number: true, customerName: true, user: { select: { name: true } }, items: { select: { productName: true, quantity: true } } } }),
    prisma.designProofFile.findMany({ where: { jobId: job.id }, orderBy: { version: "desc" } }),
  ]);
  return {
    status: job.status,
    orderNumber: order?.number ?? "",
    customerName: order?.customerName ?? order?.user?.name ?? null,
    items: order?.items ?? [],
    proofs: proofs.map((p) => ({
      id: p.id,
      version: p.version,
      url: p.url,
      fileName: p.fileName,
      isPdf: p.mimeType === "application/pdf",
      staffNote: p.staffNote,
      response: p.response,
      customerComment: p.customerComment,
      createdAt: p.createdAt,
    })),
  };
}

/** The customer approves the latest proof, or asks for changes with a comment. */
export async function respondToProof(token: string, proofId: string, decision: "APPROVED" | "CHANGES_REQUESTED", comment: string, now = new Date()) {
  const job = await prisma.designJob.findUnique({ where: { approvalToken: token } });
  if (!job) throw new DesignWorkError("This approval link is not valid.");
  const latest = await prisma.designProofFile.findFirst({ where: { jobId: job.id }, orderBy: { version: "desc" } });
  if (!latest || latest.id !== proofId) throw new DesignWorkError("A newer design has been sent. Please review the latest version.");
  if (latest.response !== "WAITING") throw new DesignWorkError("You have already answered for this design.");
  const text = comment.trim().slice(0, 2000);
  if (decision === "CHANGES_REQUESTED" && !text) throw new DesignWorkError("Please tell us what to change.");

  await prisma.$transaction([
    prisma.designProofFile.update({ where: { id: latest.id }, data: { response: decision, customerComment: text || null, respondedAt: now } }),
    prisma.designJob.update({ where: { id: job.id }, data: { status: decision === "APPROVED" ? "APPROVED" : "IN_PROGRESS" } }),
  ]);
}
