-- Orders recorded by staff from WhatsApp (no website account needed). Add-only: new nullable
-- columns, and userId becomes optional; no rows are changed or removed.
ALTER TABLE "Order" ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WEBSITE',
ALTER COLUMN "userId" DROP NOT NULL;
