import { describe, expect, it } from "vitest";
import { formatPKR } from "@/lib/money";
import { normalizePakistaniMobile, registerSchema } from "@/lib/validation";
import { safeNextPath } from "@/lib/auth/session";

describe("normalizePakistaniMobile", () => {
  it.each(["03001234567", "0300-1234567", "0300 1234567", "923001234567", "+923001234567", "00923001234567"])(
    "normalizes %s",
    (input) => expect(normalizePakistaniMobile(input)).toBe("+923001234567"),
  );
  it.each(["0211234567", "0300123456", "+14155550100", "abc"])("rejects %s", (input) =>
    expect(normalizePakistaniMobile(input)).toBeNull(),
  );
});

describe("registerSchema", () => {
  const valid = { name: "Ayesha Khan", email: "  Ayesha@Example.COM ", phone: "0300 1234567", password: "printing123" };

  it("normalizes email and phone", () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe("ayesha@example.com");
    expect(result.phone).toBe("+923001234567");
  });
  it("allows an empty phone", () => {
    expect(registerSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
  });
  it("rejects weak passwords and bad phones", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "onlyletterslong" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows local paths", () => expect(safeNextPath("/cart")).toBe("/cart"));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", undefined, 42])("blocks %s", (input) =>
    expect(safeNextPath(input)).toBe("/account"),
  );
});

describe("formatPKR", () => {
  it("formats paisa as rupees", () => {
    expect(formatPKR(125000)).toBe("PKR 1,250");
    expect(formatPKR(250)).toBe("PKR 2.50");
    expect(formatPKR(0)).toBe("PKR 0");
  });
});

import { quoteLink, whatsappLink, whatsappLinkTo } from "@/lib/business";

describe("business links", () => {
  it("builds WhatsApp and quote links", () => {
    expect(whatsappLink()).toBe("https://wa.me/923034889255");
    expect(whatsappLink("Hi there")).toBe("https://wa.me/923034889255?text=Hi%20there");
    expect(whatsappLinkTo("0300-1234567")).toBe("https://wa.me/923001234567");
    expect(whatsappLinkTo("042 1234567")).toBeNull();
    expect(quoteLink("Board Maker / 3D")).toBe("/contact?subject=Quote%3A%20Board%20Maker%20%2F%203D");
  });
});
