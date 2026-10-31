import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPKR } from "@/lib/money";
import { linePrice, resolveSelection, validateQuantity } from "@/lib/pricing";
import { createCommissionForOrder } from "@/lib/affiliate/service";
import { readSiteSettings, whatsappUrl } from "@/lib/content/site-settings";

// "Order now" on a product page: the order is saved first (status Pending, unpaid, with the affiliate from
// the referral cookie and a Pending commission), then the customer continues on WhatsApp with the order number.

export const websiteOrderSchema = z.object({
  productId: z.string().trim().min(1).max(50),
  optionValueIds: z.array(z.string().min(1).max(50)).max(20),
  quantity: z.coerce.number().int(),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^[+\d][\d\s-]{6,}$/.test(v) && v.replace(/\D/g, "").length >= 10, "Enter your mobile number, e.g. 0300 1234567."),
  city: z.string().trim().min(2, "Enter your city and address.").max(300),
  note: z.string().trim().max(500).optional().default(""),
});
export type WebsiteOrderInput = z.infer<typeof websiteOrderSchema>;

export type WebsiteOrderResult =
  | { ok: true; number: string; whatsappUrl: string; confirmationPath: string; affiliateCode: string | null }
  | { ok: false; error: string };

function secret(): string {
  return process.env.APP_SECRET ?? process.env.OTP_SECRET ?? "mixprint-order";
}

/** Signs the order number, so only the customer who placed it can open its confirmation page. */
export function confirmationToken(number: string): string {
  return createHmac("sha256", secret()).update(`order-confirm:${number}`).digest("base64url").slice(0, 32);
}

export function confirmationTokenMatches(number: string, token: string): boolean {
  const a = Buffer.from(confirmationToken(number));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function confirmationPath(number: string): string {
  return `/order/confirmed?n=${encodeURIComponent(number)}&t=${confirmationToken(number)}`;
}

type MessageInput = {
  number: string;
  productName: string;
  quantity: number;
  options: { option: string; value: string }[];
  totalMinor: number;
  name: string;
  city: string;
  note?: string | null;
  affiliateCode?: string | null;
};

/** The WhatsApp message the customer sends us; it starts with the order number so staff can match the chat. */
export function orderWhatsAppMessage(o: MessageInput): string {
  return [
    `Assalam o Alaikum! Order #${o.number}`,
    `*${o.productName}*`,
    ...o.options.map((x) => `${x.option}: ${x.value}`),
    `Quantity: ${o.quantity}`,
    `Total: ${formatPKR(o.totalMinor)}`,
    `Name: ${o.name}`,
    `City / address: ${o.city}`,
    ...(o.note ? [`Note: ${o.note}`] : []),
    ...(o.affiliateCode ? [`Ref: ${o.affiliateCode}`] : []),
  ].join("\n");
}

/** Saves the order with the server's own price calculation, then links the affiliate (if any). */
export async function placeWebsiteOrder(
  input: WebsiteOrderInput,
  ctx: { referralCode: string | null; userId?: string | null },
): Promise<WebsiteOrderResult> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      isAvailable: true,
      basePriceMinor: true,
      minQuantity: true,
      quantityStep: true,
      priceTiers: { select: { minQuantity: true, unitPriceMinor: true } },
      bulkDiscounts: { select: { minQuantity: true, percentBps: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, values: { select: { id: true, label: true, priceDeltaMinor: true, pricing: true } } },
      },
    },
  });
  if (!product || !product.isAvailable) return { ok: false, error: "This product is not available to order right now." };

  const resolved = resolveSelection(product.options, input.optionValueIds);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const quantityError = validateQuantity(product, input.quantity);
  if (quantityError) return { ok: false, error: quantityError };
  const price = linePrice(product, resolved.selection, input.quantity);
  const options = resolved.selection.map((s) => ({ option: s.option, value: s.value }));

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
      subtotalMinor: price.lineTotalMinor,
      totalMinor: price.lineTotalMinor,
      shippingAddress: { name: input.name, phone: input.phone, address: input.city },
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          optionsSummary: options,
          quantity: input.quantity,
          unitPriceMinor: Math.round(price.lineTotalMinor / input.quantity),
          lineTotalMinor: price.lineTotalMinor,
        },
      },
      statusEvents: { create: { status: "PENDING_PAYMENT", note: "Placed on the website (Order now)" } },
    },
  });

  const commission = await createCommissionForOrder(order.id, ctx.referralCode);
  const affiliateCode = commission
    ? ((await prisma.affiliate.findUnique({ where: { id: commission.affiliateId }, select: { code: true } }))?.code ?? null)
    : null;

  const message = orderWhatsAppMessage({
    number,
    productName: product.name,
    quantity: input.quantity,
    options,
    totalMinor: price.lineTotalMinor,
    name: input.name,
    city: input.city,
    note: input.note,
    affiliateCode,
  });
  return { ok: true, number, whatsappUrl: whatsappUrl(await readSiteSettings(), message), confirmationPath: confirmationPath(number), affiliateCode };
}

/** What the confirmation page shows: no phone number or address, only the order itself. */
export async function getOrderConfirmation(number: string, token: string) {
  if (!/^MP-[A-Z0-9]{4,20}$/.test(number) || !confirmationTokenMatches(number, token)) return null;
  const order = await prisma.order.findUnique({
    where: { number },
    select: {
      number: true,
      totalMinor: true,
      customerName: true,
      customerNotes: true,
      shippingAddress: true,
      items: { select: { productName: true, quantity: true, optionsSummary: true } },
      affiliate: { select: { code: true } },
    },
  });
  if (!order) return null;
  const item = order.items[0];
  const options = Array.isArray(item?.optionsSummary) ? (item.optionsSummary as { option: string; value: string }[]) : [];
  const address = (order.shippingAddress as { address?: string } | null)?.address ?? "";
  const message = orderWhatsAppMessage({
    number: order.number,
    productName: item?.productName ?? "",
    quantity: item?.quantity ?? 0,
    options,
    totalMinor: order.totalMinor,
    name: order.customerName ?? "",
    city: address,
    note: order.customerNotes,
    affiliateCode: order.affiliate?.code ?? null,
  });
  return {
    number: order.number,
    totalMinor: order.totalMinor,
    customerName: order.customerName,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
    options,
    whatsappUrl: whatsappUrl(await readSiteSettings(), message),
  };
}
