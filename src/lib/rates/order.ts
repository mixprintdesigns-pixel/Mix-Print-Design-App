import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPKR } from "@/lib/money";
import { createCommissionForOrder } from "@/lib/affiliate/service";
import { readSiteSettings, whatsappUrl } from "@/lib/content/site-settings";
import { confirmationPath, orderWhatsAppMessage, type WebsiteOrderResult } from "@/lib/orders/website-order";
import { quoteRate, SIZE_UNITS, type RateQuote } from "./calculator";
import { readRateFeatures, readRateSettings, sectionSelect } from "./queries";
import { buttonName, publicSection, ruleFor } from "./visibility";

// "Order now" from a rate page (sign boards, flex, stickers): the same flow as a product's Order now. The order is
// saved first (Pending, unpaid, with the affiliate from the referral cookie), then WhatsApp opens with the order
// number, item, option, the size as typed, the billable size and the total.
// The price is always recalculated here from the rates in the database.

const side = z.object({ value: z.coerce.number().min(0).max(100_000), inches: z.coerce.number().min(0).max(100_000).optional() });

export const rateOrderSchema = z.object({
  itemId: z.string().trim().min(1).max(50),
  variantId: z.string().trim().max(50).optional().default(""),
  unit: z.enum(SIZE_UNITS),
  width: side,
  height: side,
  quantity: z.coerce.number().int().optional().default(1),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^[+\d][\d\s-]{6,}$/.test(v) && v.replace(/\D/g, "").length >= 10, "Enter your mobile number, e.g. 0300 1234567."),
  city: z.string().trim().min(2, "Enter your city and address.").max(300),
  note: z.string().trim().max(500).optional().default(""),
});
export type RateOrderInput = z.infer<typeof rateOrderSchema>;

/** The order lines shown in Admin, on the confirmation page and in the WhatsApp message. */
export function rateOrderDetails(sectionTitle: string, itemName: string, optionLabel: string | null, q: RateQuote) {
  return [
    { option: "Item", value: itemName },
    ...(optionLabel ? [{ option: "Option", value: optionLabel }] : []),
    { option: "Rate section", value: sectionTitle },
    { option: "Size", value: q.sizeText },
    { option: "Billable size", value: q.billableText },
    { option: "Billable area", value: `${q.sqftText} sq ft${q.quantity > 1 ? ` (${q.quantity} pieces)` : ""}` },
    { option: "Rate", value: `${formatPKR(q.rateMinor)} per sq ft` },
    ...(q.minimumApplied ? [{ option: "Printing cost", value: `${formatPKR(q.printingMinor)} (minimum order)` }] : []),
    { option: "Designing charges", value: formatPKR(q.designChargeMinor) },
  ];
}

export async function placeRateOrder(input: RateOrderInput, ctx: { referralCode: string | null; userId?: string | null }): Promise<WebsiteOrderResult> {
  const unavailable = { ok: false as const, error: "This rate is not available to order right now. Please message us on WhatsApp." };
  const row = await prisma.rateItem.findFirst({
    where: { id: input.itemId, rateSection: { page: { isVisible: true, category: { isVisible: true } } } },
    select: { rateSection: { select: sectionSelect } },
  });
  const [features, settings] = await Promise.all([readRateFeatures(), readRateSettings()]);
  const section = row?.rateSection ? publicSection(row.rateSection, features) : null;
  const group = section?.groups.find((g) => g.id === input.itemId);
  if (!section || !group) return unavailable;
  // Sign boards: the quality's own rate. Flex and stickers: the button (variant) chosen.
  const button = section.kind === "SIGN_BOARD" ? group.buttons[0] : group.buttons.find((b) => b.id === input.variantId);
  if (!button) return unavailable;

  const result = quoteRate(
    { unit: input.unit, width: input.width, height: input.height, quantity: input.quantity },
    { rule: ruleFor(section.kind), rateMinor: button.rateMinor, designChargeMinor: settings.designChargeMinor, minOrderMinor: settings.minOrderMinor },
  );
  if (!result.ok) return { ok: false, error: result.error };
  const q = result.quote;
  const productName = buttonName(section, group, button);
  const options = rateOrderDetails(section.title, productName, section.kind === "SIGN_BOARD" ? group.subtitle : button.label, q);
  const number = `MP-${new Date().getFullYear().toString().slice(2)}${randomBytes(3).toString("hex").toUpperCase()}`;
  const order = await prisma.order.create({
    data: {
      number,
      source: "WEBSITE",
      userId: ctx.userId ?? null,
      customerName: input.name,
      customerPhone: input.phone,
      customerNotes: input.note || null,
      status: "PENDING_PAYMENT",
      subtotalMinor: q.totalMinor,
      totalMinor: q.totalMinor,
      shippingAddress: { name: input.name, phone: input.phone, address: input.city },
      items: {
        create: [
          {
            productName,
            optionsSummary: options,
            quantity: q.quantity,
            unitPriceMinor: Math.round(q.printingMinor / q.quantity),
            lineTotalMinor: q.printingMinor,
          },
          // Fixed design charges, always their own line.
          { productName: "Designing charges", optionsSummary: [], quantity: 1, unitPriceMinor: q.designChargeMinor, lineTotalMinor: q.designChargeMinor },
        ],
      },
      statusEvents: { create: { status: "PENDING_PAYMENT", note: "Placed on the website (rate calculator, Order now)" } },
    },
  });

  const commission = await createCommissionForOrder(order.id, ctx.referralCode);
  const affiliateCode = commission
    ? ((await prisma.affiliate.findUnique({ where: { id: commission.affiliateId }, select: { code: true } }))?.code ?? null)
    : null;

  const message = orderWhatsAppMessage({
    number,
    productName,
    quantity: q.quantity,
    options,
    totalMinor: q.totalMinor,
    name: input.name,
    city: input.city,
    note: input.note,
    affiliateCode,
  });
  return { ok: true, number, whatsappUrl: whatsappUrl(await readSiteSettings(), message), confirmationPath: confirmationPath(number), affiliateCode };
}
