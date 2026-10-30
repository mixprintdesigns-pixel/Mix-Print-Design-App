import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordOrder } from "./manual";

// Orders placed inside the AI chat: the visitor picks a product and gives name, phone and requirements.
// The order is saved as Pending (price confirmed by staff), with the affiliate code from the visitor's cookie.

export const chatOrderSchema = z.object({
  productId: z.string().trim().min(1, "Choose a product.").max(50),
  quantity: z.coerce.number().int().min(1, "Enter a quantity.").max(1_000_000),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^[+\d][\d\s-]{6,}$/.test(v), "Enter a valid phone or WhatsApp number."),
  email: z.string().trim().max(254).optional().default(""),
  requirements: z.string().trim().min(3, "Tell us a little about what you need.").max(1000),
});
export type ChatOrderInput = z.infer<typeof chatOrderSchema>;

export async function placeChatOrder(input: ChatOrderInput, referralCode: string | null) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: "PUBLISHED" },
    select: { id: true, name: true, basePriceMinor: true, minQuantity: true, priceTiers: { select: { minQuantity: true, unitPriceMinor: true } } },
  });
  if (!product) return { ok: false as const, error: "This product is not available. Please choose another." };

  // Estimated from the price list; staff confirm the final price with the customer.
  const quantity = Math.max(input.quantity, product.minQuantity);
  const tier = product.priceTiers.filter((t) => t.minQuantity <= quantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
  const totalMinor = (tier?.unitPriceMinor ?? product.basePriceMinor) * quantity;

  const result = await recordOrder(
    {
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email && z.email().safeParse(input.email).success ? input.email.toLowerCase() : null,
      referralCode,
      notes: `Requirements (from the AI chat): ${input.requirements}`,
      items: [{ productId: product.id, description: product.name, quantity, total: totalMinor }],
    },
    null,
    "CHAT",
  );
  return { ok: true as const, number: result.number, totalMinor };
}
