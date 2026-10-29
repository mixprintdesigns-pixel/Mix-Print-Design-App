-- Catalog fields for the admin product manager.
-- Hand-written so existing data is preserved: isActive is renamed (not dropped),
-- existing products get a SKU from their slug and stay published.

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "OptionKind" AS ENUM ('SIZE', 'MATERIAL', 'FINISHING', 'OTHER');
CREATE TYPE "OptionPricing" AS ENUM ('PER_UNIT', 'PER_ORDER');

-- Product
DROP INDEX "Product_categoryId_isActive_idx";
ALTER TABLE "Product" RENAME COLUMN "isActive" TO "isAvailable";
ALTER TABLE "Product"
  ADD COLUMN "affiliateCommissionBps" INTEGER,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';
UPDATE "Product" SET "sku" = UPPER("slug"), "status" = 'PUBLISHED';
ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");
CREATE INDEX "Product_status_isFeatured_idx" ON "Product"("status", "isFeatured");

-- Images, options
ALTER TABLE "ProductImage" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "ProductOption" ADD COLUMN "kind" "OptionKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ProductOptionValue" ADD COLUMN "pricing" "OptionPricing" NOT NULL DEFAULT 'PER_UNIT';

-- Bulk discounts
CREATE TABLE "BulkDiscount" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "percentBps" INTEGER NOT NULL,
    CONSTRAINT "BulkDiscount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BulkDiscount_productId_minQuantity_key" ON "BulkDiscount"("productId", "minQuantity");
ALTER TABLE "BulkDiscount" ADD CONSTRAINT "BulkDiscount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
