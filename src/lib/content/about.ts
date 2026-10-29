import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const CONTENT_TAG = "site-content";

export const aboutSchema = z.object({
  story: z.string().trim().min(10, "Write at least a few sentences.").max(4000),
  mission: z.string().trim().min(10, "Write at least one sentence.").max(1000),
  ownerName: z.string().trim().min(2, "Enter the owner's name.").max(100),
  ownerTitle: z.string().trim().max(100),
  ownerBio: z.string().trim().max(1500),
  ownerPhotoUrl: z.string().trim().max(500),
  highlights: z
    .array(z.object({ title: z.string().trim().min(2).max(60), text: z.string().trim().min(2).max(240) }))
    .min(1)
    .max(8),
});
export type AboutContent = z.infer<typeof aboutSchema>;

/** Placeholder text shown until the owner edits it in Admin → About page. */
export const DEFAULT_ABOUT: AboutContent = {
  story:
    "Mix Print Design is a printing and signage studio on Raiwind Road, Lahore. We help shops, startups, schools and brands look their best, from a box of business cards to a full backlit shop front.\n\nEvery job is checked by our design team, and nothing goes to print until you approve a proof.",
  mission:
    "To make professional printing simple, honest and affordable for every business in Pakistan, with clear prices, quality you can see, and service you can reach on WhatsApp.",
  ownerName: "Owner name",
  ownerTitle: "Founder, Mix Print Design",
  ownerBio: "Add a short introduction here: experience in printing, what you are proud of, and why customers trust you.",
  ownerPhotoUrl: "",
  highlights: [
    { title: "In-house design", text: "Our designers create or fix your artwork and send proofs before printing." },
    { title: "Quality materials", text: "Premium card stocks, flex and vinyl for colours that last." },
    { title: "Fair, clear pricing", text: "Live prices on our website and quick quotes on WhatsApp." },
    { title: "On-time delivery", text: "Production schedules you can rely on, with delivery across Pakistan." },
  ],
};

/** Uncached read, for code that runs outside page rendering (e.g. the AI assistant's index). */
export async function readAboutContent(): Promise<AboutContent> {
  const row = await prisma.siteContent.findUnique({ where: { key: "about" } });
  const parsed = aboutSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_ABOUT;
}

export async function getAboutContent(): Promise<AboutContent> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  return readAboutContent();
}

export async function saveAboutContent(content: AboutContent): Promise<void> {
  await prisma.siteContent.upsert({
    where: { key: "about" },
    create: { key: "about", value: content },
    update: { value: content },
  });
}
