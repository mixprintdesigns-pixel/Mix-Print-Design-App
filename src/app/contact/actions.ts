"use server";

import { headers } from "next/headers";
import { contactSchema, submitContactMessage } from "@/lib/contact/service";

export type ContactState = { ok?: boolean; error?: string; errors?: Record<string, string> };

export async function contactAction(_prev: ContactState, data: FormData): Promise<ContactState> {
  // Honeypot: real visitors never see or fill this field; bots often do.
  if (String(data.get("company") ?? "").trim()) return { ok: true };

  const parsed = contactSchema.safeParse({
    name: data.get("name") ?? "",
    email: data.get("email") ?? "",
    phone: data.get("phone") ?? "",
    subject: data.get("subject") ?? "",
    service: data.get("service") ?? "",
    message: data.get("message") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await submitContactMessage(parsed.data, { ip });
  if (!result.ok) return { error: "You have sent several messages in a short time. Please wait a few minutes or message us on WhatsApp." };
  return { ok: true };
}
