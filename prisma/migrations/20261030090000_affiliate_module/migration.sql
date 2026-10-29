-- Affiliate module: settings, payout details, commission breakdown and withdrawals.
-- Hand-written so existing rows survive (defaults for new required columns, payout method converted).

CREATE TYPE "PayoutMethod" AS ENUM ('JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER');
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');
ALTER TYPE "AffiliateStatus" ADD VALUE 'REJECTED';

-- Affiliate
ALTER TABLE "Affiliate"
  ADD COLUMN "adminNote" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "payoutAccountName" TEXT,
  ADD COLUMN "promotionPlan" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "website" TEXT,
  ALTER COLUMN "commissionRateBps" DROP NOT NULL,
  ALTER COLUMN "commissionRateBps" DROP DEFAULT;
-- Keep wallet/bank payout choices; cash on delivery is not a payout method.
ALTER TABLE "Affiliate" ALTER COLUMN "payoutMethod" TYPE "PayoutMethod"
  USING (CASE WHEN "payoutMethod"::text IN ('JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER')
              THEN "payoutMethod"::text::"PayoutMethod" END);
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- Clicks
ALTER TABLE "AffiliateClick" ADD COLUMN "referrer" TEXT;
CREATE INDEX "AffiliateClick_affiliateId_ipHash_createdAt_idx" ON "AffiliateClick"("affiliateId", "ipHash", "createdAt");

-- Commissions
ALTER TABLE "AffiliateCommission"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "baseAmountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "breakdown" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "note" TEXT,
  ADD COLUMN "reversedAt" TIMESTAMP(3),
  ADD COLUMN "withdrawalId" TEXT;
ALTER TABLE "AffiliateCommission" ALTER COLUMN "baseAmountMinor" DROP DEFAULT, ALTER COLUMN "breakdown" DROP DEFAULT;
CREATE INDEX "AffiliateCommission_affiliateId_status_idx" ON "AffiliateCommission"("affiliateId", "status");

-- Settings (single row)
CREATE TABLE "AffiliateSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "defaultRateBps" INTEGER NOT NULL DEFAULT 500,
    "cookieDays" INTEGER NOT NULL DEFAULT 30,
    "minWithdrawalMinor" INTEGER NOT NULL DEFAULT 100000,
    "holdDays" INTEGER NOT NULL DEFAULT 7,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateSettings_pkey" PRIMARY KEY ("id")
);

-- Withdrawals
CREATE TABLE "AffiliateWithdrawal" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "account" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "transactionRef" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "AffiliateWithdrawal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AffiliateWithdrawal_affiliateId_requestedAt_idx" ON "AffiliateWithdrawal"("affiliateId", "requestedAt");
CREATE INDEX "AffiliateWithdrawal_status_idx" ON "AffiliateWithdrawal"("status");

ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "AffiliateWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateWithdrawal" ADD CONSTRAINT "AffiliateWithdrawal_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
