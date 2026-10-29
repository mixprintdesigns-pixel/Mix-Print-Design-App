-- Additive only: service hierarchy, reviews, contact messages, page content, AI knowledge index, rate limits.
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "serviceCategoryId" TEXT,
ADD COLUMN     "serviceQualityId" TEXT,
ADD COLUMN     "serviceSubtypeId" TEXT;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSubtype" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSubtype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuality" (
    "id" TEXT NOT NULL,
    "subtypeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "ipHash" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailError" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubtype_categoryId_slug_key" ON "ServiceSubtype"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuality_subtypeId_slug_key" ON "ServiceQuality"("subtypeId", "slug");

-- CreateIndex
CREATE INDEX "Review_isPublished_sortOrder_idx" ON "Review"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_sourceType_idx" ON "KnowledgeChunk"("sourceType");

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_serviceSubtypeId_fkey" FOREIGN KEY ("serviceSubtypeId") REFERENCES "ServiceSubtype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_serviceQualityId_fkey" FOREIGN KEY ("serviceQualityId") REFERENCES "ServiceQuality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubtype" ADD CONSTRAINT "ServiceSubtype_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuality" ADD CONSTRAINT "ServiceQuality_subtypeId_fkey" FOREIGN KEY ("subtypeId") REFERENCES "ServiceSubtype"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Initial service structure supplied by the business (editable and extendable in Admin → Services).
INSERT INTO "ServiceCategory" ("id", "slug", "title", "shortDescription", "sortOrder", "isVisible", "updatedAt") VALUES
  ('svc_board_maker', 'board-maker', 'Board Maker', 'Shop signs and display boards: backlit, front-lit and 3D boards made to your size.', 0, true, CURRENT_TIMESTAMP),
  ('svc_offset', 'offset-printing', 'Offset Printing', 'High-volume printing for business cards, flyers, brochures, letterheads and more.', 1, true, CURRENT_TIMESTAMP),
  ('svc_digital', 'digital-printing', 'Digital Printing', 'Fast, short-run and large-format digital printing: flex, vinyl, stickers and standees.', 2, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "ServiceSubtype" ("id", "categoryId", "slug", "title", "shortDescription", "sortOrder", "isVisible", "updatedAt") VALUES
  ('svc_board_backlit', 'svc_board_maker', 'backlit', 'Backlit', 'Illuminated from behind for bright, eye-catching signage day and night.', 0, true, CURRENT_TIMESTAMP),
  ('svc_board_frontlit', 'svc_board_maker', 'front-lit', 'Front-lit', 'Lit from the front with spotlights: an economical, clear sign for any shop front.', 1, true, CURRENT_TIMESTAMP),
  ('svc_board_3d', 'svc_board_maker', '3d', '3D', 'Raised 3D letters and logos for a premium, dimensional look.', 2, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
