import "server-only";
import { z } from "zod";
import { hashIp } from "@/lib/affiliate/service";
import { BUSINESS } from "@/lib/business";
import { prisma } from "@/lib/db";
import { resendTransport, type EmailTransport } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^[+\d][\d\s-]{6,}$/.test(v), "Enter a valid phone number.")
    .transform((v) => v || null),
  subject: z
    .string()
    .trim()
    .max(150)
    .transform((v) => v || null),
  message: z.string().trim().min(10, "Please write a little more (at least 10 characters).").max(5000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const CONTACT_LIMIT = { perWindow: 5, windowMs: 10 * 60 * 1000 };

export type SubmitResult = { ok: true; emailed: boolean } | { ok: false; reason: "rate-limited" };

/** Stores the message, then emails it to the business inbox. A failed email never loses the message. */
export async function submitContactMessage(
  input: ContactInput,
  meta: { ip?: string | null },
  transport: EmailTransport = resendTransport,
): Promise<SubmitResult> {
  const ipHash = meta.ip ? hashIp(meta.ip) : null;
  if (!(await rateLimit(`contact:${ipHash ?? "unknown"}`, CONTACT_LIMIT.perWindow, CONTACT_LIMIT.windowMs)).allowed) {
    return { ok: false, reason: "rate-limited" };
  }

  const saved = await prisma.contactMessage.create({ data: { ...input, ipHash } });
  const result = await transport({
    to: BUSINESS.email,
    replyTo: input.email,
    subject: `Website enquiry${input.subject ? `: ${input.subject}` : ""} — ${input.name}`,
    text: [
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Phone: ${input.phone ?? "—"}`,
      `Subject: ${input.subject ?? "—"}`,
      "",
      input.message,
      "",
      `Saved in Admin → Contact messages (id ${saved.id}).`,
    ].join("\n"),
  });
  await prisma.contactMessage.update({
    where: { id: saved.id },
    data: result.sent ? { emailSentAt: new Date() } : { emailError: result.error.slice(0, 500) },
  });
  return { ok: true, emailed: result.sent };
}

export async function listContactMessages(filter: { open?: boolean }) {
  return prisma.contactMessage.findMany({
    where: filter.open ? { handledAt: null } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function setMessageHandled(id: string, handled: boolean) {
  await prisma.contactMessage.update({ where: { id }, data: { handledAt: handled ? new Date() : null } });
}
