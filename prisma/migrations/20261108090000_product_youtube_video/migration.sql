-- Optional YouTube video per product, shown in the product's image gallery. Add-only: three new nullable / defaulted columns.
ALTER TABLE "Product" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "youtubeVideoFirst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "youtubeAddedAt" TIMESTAMP(3);
