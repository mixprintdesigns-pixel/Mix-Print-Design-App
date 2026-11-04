-- Rate sections (owner update, 5 Nov 2026). Additive only: new tables and columns; existing rates and items are kept.
-- CreateEnum
CREATE TYPE "RateSectionKind" AS ENUM ('FLEX', 'STICKER', 'SIGN_BOARD');

-- AlterTable
ALTER TABLE "RateItem" ADD COLUMN     "featureIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sectionId" TEXT;


-- CreateTable
CREATE TABLE "RateSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "RateSectionKind" NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateFeature" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateSection_pageId_sortOrder_idx" ON "RateSection"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "RateItem_sectionId_sortOrder_idx" ON "RateItem"("sectionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RateItem" ADD CONSTRAINT "RateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RateSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateSection" ADD CONSTRAINT "RateSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "RatePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Data: move what exists into sections, keeping every item and rate ─────────────────────────────────────
-- Runs once per rate page (only pages that have no section yet). Nothing is deleted or overwritten.
--  * Sign board pages: one Sign Board section; every existing item becomes a quality (rate, text kept).
--  * Digital Printing: a Flex section (GSM row + "Most Famous Flex Names" row), a Backlit Flex section (the
--    existing Backlit Flex item and its GSM rates) and a Sticker section (the existing sticker items).
--    Rates already set on the old flex items are copied onto famous-name buttons ("China Flex 240 GSM"); the old
--    flex items stay in the database unchanged.
--  * A new rate page for 3D Sign Board, and a starting features list. All new rates are 0 (not shown).

INSERT INTO "RateFeature" (id, label, "sortOrder")
SELECT v.id, v.label, v.sort FROM (VALUES
  ('ratefeat_waterproof', 'Waterproof', 0), ('ratefeat_led', 'LED lights', 1), ('ratefeat_acrylic', 'Acrylic', 2),
  ('ratefeat_frame', 'Strong frame', 3), ('ratefeat_warranty', 'Warranty', 4)) AS v(id, label, sort)
WHERE NOT EXISTS (SELECT 1 FROM "RateFeature");

DO $sections$
DECLARE
  p record; it record; v record;
  v_root text; v_cat record; v_sec text; v_kind "RateSectionKind";
  v_board text; v_3d text; v_page text; i int; q text;
  gsm int[]; series text[];
BEGIN
  SELECT COALESCE("gsmOptions", ARRAY[200,220,240,260,280,300,320,340,360,380,400]), COALESCE("seriesOptions", ARRAY['1000 series','2000 series','3000 series'])
    INTO gsm, series FROM "RateSettings" WHERE id = 'default';
  IF gsm IS NULL THEN gsm := ARRAY[200,220,240,260,280,300,320,340,360,380,400]; series := ARRAY['1000 series','2000 series','3000 series']; END IF;

  -- 3D Sign Board gets a rate page too
  SELECT id INTO v_board FROM "Category" WHERE "parentId" IS NULL AND slug = 'board-maker';
  IF v_board IS NOT NULL THEN
    SELECT id INTO v_3d FROM "Category" WHERE "parentId" = v_board AND slug = '3d-sign-board';
    IF v_3d IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "RatePage" WHERE "categoryId" = v_3d) THEN
      INSERT INTO "RatePage" (id, "categoryId", title, intro, "sortOrder", "updatedAt") VALUES ('ratepage_3d', v_3d,
        '3D Sign Board Price per Sq Ft in Lahore',
        'Choose a quality, enter your board size and see the price at once. Each side is charged to the next full foot.', 3, now())
      ON CONFLICT (id) DO NOTHING;
      i := 0;
      FOREACH q IN ARRAY ARRAY['Normal', 'Medium', 'Premium'] LOOP
        INSERT INTO "RateItem" (id, "pageId", name, subtitle, description, "sortOrder", "updatedAt")
        VALUES ('rateitem_3d_' || lower(q), 'ratepage_3d',
          CASE q WHEN 'Normal' THEN 'Economy' WHEN 'Medium' THEN 'Standard' ELSE 'Premium' END || ' 3D Sign Board', q,
          'Write here: the material used, its qualities and benefits, and what it is proof against (for example waterproof, UV resistant, outdoor life).', i, now())
        ON CONFLICT (id) DO NOTHING;
        i := i + 1;
      END LOOP;
    END IF;
  END IF;

  FOR p IN SELECT * FROM "RatePage" rp WHERE NOT EXISTS (SELECT 1 FROM "RateSection" s WHERE s."pageId" = rp.id) LOOP
    -- The main service the page sits under
    v_root := NULL;
    SELECT * INTO v_cat FROM "Category" WHERE id = p."categoryId";
    IF FOUND THEN
      v_root := v_cat.slug;
      WHILE v_cat."parentId" IS NOT NULL LOOP
        SELECT * INTO v_cat FROM "Category" WHERE id = v_cat."parentId";
        EXIT WHEN NOT FOUND;
        v_root := v_cat.slug;
      END LOOP;
    END IF;

    IF v_root = 'digital-printing' AND (SELECT "parentId" FROM "Category" WHERE id = p."categoryId") IS NULL THEN
      -- Flex: GSM row + Most Famous Flex Names
      v_sec := 'ratesec_' || p.id || '_flex';
      INSERT INTO "RateSection" (id, "pageId", title, kind, "sortOrder", "updatedAt") VALUES (v_sec, p.id, 'Flex GSM & Rate per sq ft (Rs)', 'FLEX', 0, now()) ON CONFLICT DO NOTHING;
      INSERT INTO "RateItem" (id, "pageId", "sectionId", section, name, "variantType", "sortOrder", "updatedAt")
        VALUES (v_sec || '_gsm', p.id, v_sec, 'Flex', 'Flex', 'GSM', 0, now()) ON CONFLICT DO NOTHING;
      FOR i IN 1 .. array_length(gsm, 1) LOOP
        INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES (v_sec || '_gsm_' || gsm[i], v_sec || '_gsm', gsm[i] || ' GSM', i) ON CONFLICT DO NOTHING;
      END LOOP;
      INSERT INTO "RateItem" (id, "pageId", "sectionId", section, name, "variantType", "sortOrder", "updatedAt")
        VALUES (v_sec || '_famous', p.id, v_sec, 'Flex', 'Most Famous Flex Names', 'GSM', 1, now()) ON CONFLICT DO NOTHING;
      i := 0;
      FOREACH q IN ARRAY ARRAY['China Flex 240 GSM', 'HD Star Flex 280 GSM', 'Star Flex 320 GSM', 'Korean Star 400 GSM'] LOOP
        INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES (v_sec || '_famous_' || i, v_sec || '_famous', q, i) ON CONFLICT DO NOTHING;
        i := i + 1;
      END LOOP;

      -- Backlit Flex: the existing Backlit Flex item (with its GSM rates), or a new GSM row
      v_sec := 'ratesec_' || p.id || '_backlitflex';
      INSERT INTO "RateSection" (id, "pageId", title, kind, "sortOrder", "updatedAt") VALUES (v_sec, p.id, 'Backlit Flex GSM & Rate per sq ft (Rs)', 'FLEX', 1, now()) ON CONFLICT DO NOTHING;
      IF EXISTS (SELECT 1 FROM "RateItem" WHERE id = 'rateitem_backlit-flex' AND "pageId" = p.id AND "sectionId" IS NULL) THEN
        UPDATE "RateItem" SET "sectionId" = v_sec, "sortOrder" = 0 WHERE id = 'rateitem_backlit-flex';
      ELSE
        INSERT INTO "RateItem" (id, "pageId", "sectionId", section, name, "variantType", "sortOrder", "updatedAt")
          VALUES (v_sec || '_gsm', p.id, v_sec, 'Flex', 'Backlit Flex', 'GSM', 0, now()) ON CONFLICT DO NOTHING;
        FOR i IN 1 .. array_length(gsm, 1) LOOP
          INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES (v_sec || '_gsm_' || gsm[i], v_sec || '_gsm', gsm[i] || ' GSM', i) ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;

      -- Stickers: one column per existing sticker item, each with series buttons
      v_sec := 'ratesec_' || p.id || '_sticker';
      INSERT INTO "RateSection" (id, "pageId", title, kind, "sortOrder", "updatedAt") VALUES (v_sec, p.id, 'Sticker Series & Rate per sq ft (Rs)', 'STICKER', 2, now()) ON CONFLICT DO NOTHING;
      FOR it IN SELECT * FROM "RateItem" WHERE "pageId" = p.id AND "sectionId" IS NULL AND ("variantType" = 'SERIES' OR section ILIKE '%sticker%') ORDER BY "sortOrder" LOOP
        UPDATE "RateItem" SET "sectionId" = v_sec WHERE id = it.id;
        IF NOT EXISTS (SELECT 1 FROM "RateVariant" WHERE "itemId" = it.id) THEN
          FOR i IN 1 .. array_length(series, 1) LOOP
            INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES (it.id || '_s' || i, it.id, series[i], i) ON CONFLICT DO NOTHING;
          END LOOP;
          IF it."rateMinor" > 0 THEN -- a single rate set earlier is kept as its own button
            INSERT INTO "RateVariant" (id, "itemId", label, "rateMinor", "sortOrder") VALUES (it.id || '_rate', it.id, 'Standard', it."rateMinor", 0) ON CONFLICT DO NOTHING;
          END IF;
        END IF;
      END LOOP;

      -- Rates already set on the old flex items become famous-name buttons
      FOR it IN SELECT * FROM "RateItem" WHERE "pageId" = p.id AND "sectionId" IS NULL ORDER BY "sortOrder" LOOP
        FOR v IN SELECT * FROM "RateVariant" WHERE "itemId" = it.id AND "rateMinor" > 0 ORDER BY "sortOrder" LOOP
          INSERT INTO "RateVariant" (id, "itemId", label, "rateMinor", "isVisible", "sortOrder")
          VALUES ('ratesec_' || p.id || '_flex_famous_' || v.id, 'ratesec_' || p.id || '_flex_famous', it.name || ' ' || v.label, v."rateMinor", v."isVisible" AND it."isVisible", 100 + it."sortOrder" * 20 + v."sortOrder")
          ON CONFLICT ("itemId", label) DO UPDATE SET "rateMinor" = EXCLUDED."rateMinor" WHERE "RateVariant"."rateMinor" = 0;
        END LOOP;
        IF it."rateMinor" > 0 AND it."variantType" = 'NONE' THEN
          INSERT INTO "RateVariant" (id, "itemId", label, "rateMinor", "isVisible", "sortOrder")
          VALUES ('ratesec_' || p.id || '_flex_famous_' || it.id, 'ratesec_' || p.id || '_flex_famous', it.name, it."rateMinor", it."isVisible", 100 + it."sortOrder" * 20)
          ON CONFLICT ("itemId", label) DO NOTHING;
        END IF;
      END LOOP;
    ELSE
      -- Sign boards (and anything else): one section; every existing item joins it as it is
      v_kind := CASE
        WHEN v_root = 'board-maker' THEN 'SIGN_BOARD'
        WHEN EXISTS (SELECT 1 FROM "RateItem" WHERE "pageId" = p.id AND "variantType" = 'SERIES') THEN 'STICKER'
        WHEN EXISTS (SELECT 1 FROM "RateItem" WHERE "pageId" = p.id AND "variantType" = 'GSM') THEN 'FLEX'
        ELSE 'SIGN_BOARD' END;
      v_sec := 'ratesec_' || p.id;
      INSERT INTO "RateSection" (id, "pageId", title, kind, "sortOrder", "updatedAt")
      VALUES (v_sec, p.id, COALESCE((SELECT name FROM "Category" WHERE id = p."categoryId"), 'Rates') || ' Rate per sq ft (Rs)', v_kind, 0, now())
      ON CONFLICT DO NOTHING;
      UPDATE "RateItem" SET "sectionId" = v_sec WHERE "pageId" = p.id AND "sectionId" IS NULL;
    END IF;
  END LOOP;
END $sections$;
