-- Admin sections: Design work, Customers (notes), Payments. Add-only: new types and tables,
-- no changes to existing tables. Order and user ids are stored as plain references.
CREATE TYPE "DesignJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SENT_FOR_APPROVAL', 'APPROVED');
CREATE TYPE "DesignProofResponse" AS ENUM ('WAITING', 'APPROVED', 'CHANGES_REQUESTED');
CREATE TYPE "ManualPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA');

CREATE TABLE "DesignJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "DesignJobStatus" NOT NULL DEFAULT 'PENDING',
    "brief" TEXT,
    "approvalToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DesignJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesignJob_orderId_key" ON "DesignJob"("orderId");
CREATE UNIQUE INDEX "DesignJob_approvalToken_key" ON "DesignJob"("approvalToken");
CREATE INDEX "DesignJob_status_idx" ON "DesignJob"("status");

CREATE TABLE "DesignProofFile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "staffNote" TEXT,
    "response" "DesignProofResponse" NOT NULL DEFAULT 'WAITING',
    "customerComment" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignProofFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DesignProofFile_jobId_version_idx" ON "DesignProofFile"("jobId", "version");

CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerNote_customerKey_key" ON "CustomerNote"("customerKey");

CREATE TABLE "OrderPaymentRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" "ManualPaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPaymentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderPaymentRecord_orderId_idx" ON "OrderPaymentRecord"("orderId");
CREATE INDEX "OrderPaymentRecord_receivedAt_idx" ON "OrderPaymentRecord"("receivedAt");
