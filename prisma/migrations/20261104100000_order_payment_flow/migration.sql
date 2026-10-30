-- Order flow with 50% advance: new statuses, payments received, customer email, work photos. Add-only.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ADVANCE_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'WORK_COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FULLY_PAID';

ALTER TABLE "Order" ADD COLUMN "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "customerEmail" TEXT;

CREATE TABLE "OrderPhoto" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderPhoto_orderId_idx" ON "OrderPhoto"("orderId");
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
