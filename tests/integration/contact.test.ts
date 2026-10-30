import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { CONTACT_LIMIT, contactSchema, submitContactMessage } from "@/lib/contact/service";
import type { Email } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { resetDatabase } from "../support/db";

const input = contactSchema.parse({
  name: "Hamza Ali",
  email: "Hamza@Example.com",
  phone: "0300 1234567",
  subject: "Quote: Board Maker / Backlit",
  service: "Sign Board Maker",
  message: "I need a 6x3 ft backlit board for my shop.",
});

beforeEach(resetDatabase);

describe("contact form", () => {
  it("stores the message and emails it to the business inbox with reply-to", async () => {
    const sent: Email[] = [];
    const result = await submitContactMessage(input, { ip: "1.2.3.4" }, async (email) => {
      sent.push(email);
      return { sent: true };
    });
    expect(result).toEqual({ ok: true, emailed: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "mixprintdesigns@gmail.com", replyTo: "hamza@example.com" });
    expect(sent[0].subject).toContain("Quote: Board Maker / Backlit");
    expect(sent[0].text).toContain("6x3 ft backlit board");
    expect(sent[0].text).toContain("Service: Sign Board Maker");

    const saved = await prisma.contactMessage.findFirstOrThrow();
    expect(saved).toMatchObject({ name: "Hamza Ali", email: "hamza@example.com", service: "Sign Board Maker", emailError: null });
    expect(saved.emailSentAt).not.toBeNull();
    expect(saved.ipHash).not.toContain("1.2.3.4");
  });

  it("keeps the message when the email fails", async () => {
    const result = await submitContactMessage(input, { ip: "1.2.3.4" }, async () => ({ sent: false, error: "Email is not configured" }));
    expect(result).toEqual({ ok: true, emailed: false });
    expect(await prisma.contactMessage.findFirstOrThrow()).toMatchObject({ emailSentAt: null, emailError: "Email is not configured" });
  });

  it("rate-limits repeated submissions from the same visitor", async () => {
    const ok = async () => ({ sent: true as const });
    for (let i = 0; i < CONTACT_LIMIT.perWindow; i++) {
      expect((await submitContactMessage(input, { ip: "5.5.5.5" }, ok)).ok).toBe(true);
    }
    expect(await submitContactMessage(input, { ip: "5.5.5.5" }, ok)).toEqual({ ok: false, reason: "rate-limited" });
    expect((await submitContactMessage(input, { ip: "6.6.6.6" }, ok)).ok).toBe(true);
    expect(await prisma.contactMessage.count()).toBe(CONTACT_LIMIT.perWindow + 1);
  });

  it("validates input", () => {
    const bad = contactSchema.safeParse({ name: "A", email: "nope", phone: "abc", subject: "", message: "short" });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.path[0]).sort()).toEqual(["email", "message", "name", "phone"]);
  });
});

describe("rateLimit", () => {
  it("allows requests again after the window", async () => {
    const t = new Date("2026-10-31T10:00:00Z");
    expect((await rateLimit("k", 1, 60_000, t)).allowed).toBe(true);
    expect((await rateLimit("k", 1, 60_000, new Date(t.getTime() + 30_000))).allowed).toBe(false);
    expect((await rateLimit("k", 1, 60_000, new Date(t.getTime() + 61_000))).allowed).toBe(true);
  });
});
