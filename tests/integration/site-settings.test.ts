import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS, readSiteSettings, saveSiteSettings, siteSettingsSchema, whatsappUrl } from "@/lib/content/site-settings";
import { resetDatabase } from "../support/db";

beforeEach(resetDatabase);

describe("site settings", () => {
  it("uses the business details until the owner saves their own", async () => {
    expect(await readSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
    expect(whatsappUrl(DEFAULT_SITE_SETTINGS, "Hi")).toBe("https://wa.me/923034889255?text=Hi");
  });

  it("validates and saves contact details and social links", async () => {
    const input = { ...DEFAULT_SITE_SETTINGS, whatsappNumber: "+92 300 1234567", instagramUrl: "https://instagram.com/mixprintdesign" };
    const parsed = siteSettingsSchema.parse(input);
    expect(parsed.whatsappNumber).toBe("923001234567");
    await saveSiteSettings(parsed);
    expect(await readSiteSettings()).toMatchObject({ whatsappNumber: "923001234567", instagramUrl: "https://instagram.com/mixprintdesign" });

    expect(siteSettingsSchema.safeParse({ ...input, tiktokUrl: "tiktok.com/x" }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ ...input, mapEmbedUrl: "https://evil.example/maps" }).success).toBe(false);
  });
});
