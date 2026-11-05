-- Rates everywhere, per-sq-ft commission, 3D Wallpaper and its gallery (owner request, Nov 2026). Additive only.
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "focusKeyword" TEXT,
ADD COLUMN     "ogImageKey" TEXT,
ADD COLUMN     "ogImageUrl" TEXT;

-- AlterTable
ALTER TABLE "RateSection" ADD COLUMN     "askDesignCode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bonusSlabs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "commissionPerSqftMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fittingRateMinor" INTEGER,
ADD COLUMN     "showOnCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RateVariant" ADD COLUMN     "rule" "RateSectionKind";


-- CreateTable
CREATE TABLE "CategoryImage" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallpaperCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallpaperCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallpaperDesign" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "extraImages" JSONB NOT NULL DEFAULT '[]',
    "driveUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallpaperDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryImage_categoryId_sortOrder_idx" ON "CategoryImage"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WallpaperCategory_slug_key" ON "WallpaperCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WallpaperDesign_code_key" ON "WallpaperDesign"("code");

-- AddForeignKey
ALTER TABLE "CategoryImage" ADD CONSTRAINT "CategoryImage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallpaperDesign" ADD CONSTRAINT "WallpaperDesign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WallpaperCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Data (inserts and filling new, empty columns only; no existing rate, item or button is changed) ───────
-- 1. Affiliate commission per billable sq ft, by section type: Flex Rs 5, Stickers Rs 10, Sign Boards Rs 50.
UPDATE "RateSection" SET "commissionPerSqftMinor" = CASE kind WHEN 'FLEX' THEN 500 WHEN 'STICKER' THEN 1000 ELSE 5000 END
WHERE "commissionPerSqftMinor" = 0;

-- 2. "Reflective Flex …" buttons use the Sticker pricing rule (media-width rules); all other buttons keep their section's rule.
UPDATE "RateVariant" SET rule = 'STICKER' WHERE label ILIKE 'reflective flex%' AND rule IS NULL;

DO $everywhere$
DECLARE
  v_dp text; v_board text; v_flexp text; v_pana text; v_vinyl text; v_wall text; v_sec text; s record; i int; q text;
BEGIN
  SELECT id INTO v_dp FROM "Category" WHERE "parentId" IS NULL AND slug = 'digital-printing';
  SELECT id INTO v_board FROM "Category" WHERE "parentId" IS NULL AND slug = 'board-maker';

  -- 3. Where each section also shows (with every page inside those pages):
  --    Flex → Flex Printing (China, HD Star, Star, Korean Star Flex) and Panaflex; Stickers → Vinyl / One-way Vision;
  --    each sign board section → its own board page and the pages inside it (Normal, Medium, Premium, 3D types).
  IF v_dp IS NOT NULL THEN
    SELECT id INTO v_flexp FROM "Category" WHERE "parentId" = v_dp AND slug = 'flex-printing';
    SELECT id INTO v_pana FROM "Category" WHERE "parentId" = v_dp AND slug = 'panaflex';
    SELECT id INTO v_vinyl FROM "Category" WHERE "parentId" = v_dp AND slug = 'vinyl-one-way-vision';
    UPDATE "RateSection" SET "showOnCategoryIds" = array_remove(ARRAY[v_flexp, v_pana], NULL)
      WHERE id LIKE 'ratesec\_%\_flex' AND id NOT LIKE '%backlitflex' AND kind = 'FLEX' AND cardinality("showOnCategoryIds") = 0;
    UPDATE "RateSection" SET "showOnCategoryIds" = array_remove(ARRAY[v_vinyl], NULL)
      WHERE id LIKE 'ratesec\_%\_sticker' AND kind = 'STICKER' AND cardinality("showOnCategoryIds") = 0;
  END IF;
  FOR s IN SELECT rs.id, rp."categoryId" FROM "RateSection" rs JOIN "RatePage" rp ON rp.id = rs."pageId"
           WHERE rs.kind = 'SIGN_BOARD' AND rp."categoryId" IS NOT NULL AND cardinality(rs."showOnCategoryIds") = 0 LOOP
    UPDATE "RateSection" SET "showOnCategoryIds" = ARRAY[s."categoryId"] WHERE id = s.id;
  END LOOP;

  -- 4. New sub-service: 3D Wallpaper under Digital Printing, with its rate section (Flex rule, fitting charges, design codes)
  IF v_dp IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Category" WHERE "parentId" = v_dp AND slug = '3d-wallpaper') THEN
    v_wall := 'cat_' || substr(md5(v_dp || '/3d-wallpaper'), 1, 20);
    INSERT INTO "Category" (id, name, slug, description, content, "sortOrder", "parentId", "priceUnit", "createdAt", "updatedAt")
    VALUES (v_wall, '3D Wallpaper', '3d-wallpaper',
      'Custom 3D wallpaper for homes and offices in Lahore: printed to your wall size and fitted by our team.',
      'Give any room a new look with custom 3D wallpaper from Mix Print Design. Choose a design from our gallery, or send us your own picture, and we print it to the exact size of your wall.

3D wallpaper suits living rooms, bedrooms, kids rooms, offices, restaurants and shops. Pick the wallpaper type, enter your wall size and see the price at once, with or without fitting by our team in Lahore.

Send us your wall size and a photo on WhatsApp, and we will help you choose the design and finish.',
      COALESCE((SELECT max("sortOrder") + 1 FROM "Category" WHERE "parentId" = v_dp), 0), v_dp, 'per sq. ft', now(), now());
    INSERT INTO "RatePage" (id, "categoryId", title, intro, "sortOrder", "updatedAt") VALUES ('ratepage_3d_wallpaper', v_wall,
      '3D Wallpaper Price per Sq Ft in Lahore',
      'Choose a wallpaper type, enter your wall size and see the price at once, with or without fitting. Each side is charged to the next full foot.', 4, now())
    ON CONFLICT (id) DO NOTHING;
    v_sec := 'ratesec_ratepage_3d_wallpaper';
    INSERT INTO "RateSection" (id, "pageId", title, kind, "commissionPerSqftMinor", "fittingRateMinor", "askDesignCode", "sortOrder", "updatedAt")
    VALUES (v_sec, 'ratepage_3d_wallpaper', '3D Wallpaper Types & Rate per sq ft (Rs)', 'FLEX', 500, 0, true, 0, now()) ON CONFLICT DO NOTHING;
    INSERT INTO "RateItem" (id, "pageId", "sectionId", name, "variantType", "sortOrder", "updatedAt")
    VALUES (v_sec || '_types', 'ratepage_3d_wallpaper', v_sec, '3D Wallpaper', 'GSM', 0, now()) ON CONFLICT DO NOTHING;
    i := 0;
    FOREACH q IN ARRAY ARRAY['Standard', 'Premium', 'Luxury'] LOOP
      INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES (v_sec || '_types_' || i, v_sec || '_types', q, i) ON CONFLICT DO NOTHING;
      i := i + 1;
    END LOOP;
  END IF;
END $everywhere$;

-- 5. 3D Wallpaper gallery categories (editable in Admin)
INSERT INTO "WallpaperCategory" (id, name, slug, "sortOrder", "updatedAt")
SELECT 'wpcat_' || v.slug, v.name, v.slug, v.sort, now() FROM (VALUES
  ('Living Room', 'living-room', 0), ('Bedroom', 'bedroom', 1), ('Kids Room', 'kids-room', 2), ('Office', 'office', 3),
  ('Restaurant', 'restaurant', 4), ('Gaming Room', 'gaming-room', 5), ('Industrial', 'industrial', 6)) AS v(name, slug, sort)
WHERE NOT EXISTS (SELECT 1 FROM "WallpaperCategory")
ON CONFLICT DO NOTHING;
