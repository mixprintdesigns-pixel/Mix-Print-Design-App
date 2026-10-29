-- Additive only: phone verification timestamp and pending affiliate signups with hashed codes.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AffiliateSignup" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "payoutMethod" "PayoutMethod" NOT NULL,
    "payoutAccount" TEXT NOT NULL,
    "payoutAccountName" TEXT NOT NULL,
    "website" TEXT,
    "promotionPlan" TEXT NOT NULL,
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" TIMESTAMP(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailLastSentAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneCodeHash" TEXT,
    "phoneCodeExpiresAt" TIMESTAMP(3),
    "phoneAttempts" INTEGER NOT NULL DEFAULT 0,
    "phoneLastSentAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSignup_tokenHash_key" ON "AffiliateSignup"("tokenHash");

-- CreateIndex
CREATE INDEX "AffiliateSignup_email_idx" ON "AffiliateSignup"("email");

-- CreateIndex
CREATE INDEX "AffiliateSignup_phone_idx" ON "AffiliateSignup"("phone");

-- AddForeignKey
ALTER TABLE "AffiliateSignup" ADD CONSTRAINT "AffiliateSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

