-- Product video position: FIRST, AFTER_FIRST or LAST (after all images, the default). Add-only: a new column.
ALTER TABLE "Product" ADD COLUMN "youtubeVideoPosition" TEXT NOT NULL DEFAULT 'LAST';
-- Products that already have a video show it after all their images (the new default).
UPDATE "Product" SET "youtubeVideoPosition" = 'LAST' WHERE "youtubeUrl" IS NOT NULL;
