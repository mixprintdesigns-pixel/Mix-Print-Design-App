-- Fixed affiliate commission (Rs per order of the product). Add-only.
ALTER TABLE "Product" ADD COLUMN "affiliateCommissionMinor" INTEGER;
