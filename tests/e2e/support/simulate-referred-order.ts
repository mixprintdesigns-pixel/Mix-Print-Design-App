// Stands in for checkout (not built yet) in end-to-end tests: creates a delivered order for
// `buyerEmail` and runs the same affiliate hooks checkout and order management will call.
// Run with: tsx --conditions=react-server tests/e2e/support/simulate-referred-order.ts <buyerEmail> <code> <amountPaisa>
import { prisma } from "@/lib/db";
import { approveDueCommissions, createCommissionForOrder } from "@/lib/affiliate/service";

async function main() {
  const [buyerEmail, code, amount] = process.argv.slice(2);
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: buyerEmail } });
  const lineTotal = Number(amount);
  const order = await prisma.order.create({
    data: {
      number: `MP-E2E-${Date.now().toString(36).toUpperCase()}`,
      userId: buyer.id,
      status: "DELIVERED",
      subtotalMinor: lineTotal,
      shippingMinor: 25_000,
      totalMinor: lineTotal + 25_000,
      shippingAddress: { city: "Lahore" },
      items: { create: { productName: "A5 Flyers", optionsSummary: [], quantity: 5000, unitPriceMinor: lineTotal / 5000, lineTotalMinor: lineTotal } },
      // delivered well before the hold period so the commission can be approved now
      statusEvents: { create: { status: "DELIVERED", createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
    },
  });
  const commission = await createCommissionForOrder(order.id, code);
  await approveDueCommissions();
  console.log(JSON.stringify({ order: order.number, commission: commission?.amountMinor ?? null }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
