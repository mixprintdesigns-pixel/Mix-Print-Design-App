-- Rates: per-square-foot prices with a size calculator (owner request, 4 Nov 2026). Additive only: new tables, nothing changed or dropped.
-- CreateEnum
CREATE TYPE "RateVariantType" AS ENUM ('NONE', 'GSM', 'SERIES');


-- CreateTable
CREATE TABLE "RatePage" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateItem" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "section" TEXT,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "imageAlt" TEXT,
    "rateMinor" INTEGER NOT NULL DEFAULT 0,
    "variantType" "RateVariantType" NOT NULL DEFAULT 'NONE',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateVariant" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rateMinor" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "designChargeMinor" INTEGER NOT NULL DEFAULT 100000,
    "minOrderMinor" INTEGER,
    "gsmOptions" INTEGER[] DEFAULT ARRAY[200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400]::INTEGER[],
    "seriesOptions" TEXT[] DEFAULT ARRAY['1000 series', '2000 series', '3000 series']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RatePage_categoryId_key" ON "RatePage"("categoryId");

-- CreateIndex
CREATE INDEX "RateItem_pageId_sortOrder_idx" ON "RateItem"("pageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RateVariant_itemId_label_key" ON "RateVariant"("itemId", "label");

-- AddForeignKey
ALTER TABLE "RatePage" ADD CONSTRAINT "RatePage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateItem" ADD CONSTRAINT "RateItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "RatePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateVariant" ADD CONSTRAINT "RateVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Starting data: placeholders the owner edits in Admin → Rates. Every rate is 0, so nothing shows on the website
-- until a rate is set. Inserted only once (fixed ids, ON CONFLICT DO NOTHING); never overwrites the owner's edits.
INSERT INTO "RateSettings" ("id", "updatedAt") VALUES ('default', now()) ON CONFLICT ("id") DO NOTHING;

DO $rates$
DECLARE
  v_board text; v_backlit text; v_frontlit text; v_digital text;
  gsm int[] := ARRAY[200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400];
  series text[] := ARRAY['1000 series', '2000 series', '3000 series'];
  r record; g int; s text; i int;
BEGIN
  SELECT id INTO v_board FROM "Category" WHERE "parentId" IS NULL AND slug = 'board-maker';
  SELECT id INTO v_digital FROM "Category" WHERE "parentId" IS NULL AND slug = 'digital-printing';
  IF v_board IS NOT NULL THEN
    SELECT id INTO v_backlit FROM "Category" WHERE "parentId" = v_board AND slug = 'backlit-sign-board';
    SELECT id INTO v_frontlit FROM "Category" WHERE "parentId" = v_board AND slug = 'front-lit-sign-board';
  END IF;

  -- Pages (only for service pages that exist and have no rate page yet)
  IF v_backlit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "RatePage" WHERE "categoryId" = v_backlit) THEN
    INSERT INTO "RatePage" (id, "categoryId", title, intro, "sortOrder", "updatedAt") VALUES ('ratepage_backlit', v_backlit,
      'Backlit Sign Board Price per Sq Ft in Lahore',
      'Choose a quality, enter your board size and see the price at once. Each side is charged to the next full foot.', 0, now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF v_frontlit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "RatePage" WHERE "categoryId" = v_frontlit) THEN
    INSERT INTO "RatePage" (id, "categoryId", title, intro, "sortOrder", "updatedAt") VALUES ('ratepage_frontlit', v_frontlit,
      'Front-lit Sign Board Price per Sq Ft in Lahore',
      'Choose a quality, enter your board size and see the price at once. Each side is charged to the next full foot.', 1, now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF v_digital IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "RatePage" WHERE "categoryId" = v_digital) THEN
    INSERT INTO "RatePage" (id, "categoryId", title, intro, "sortOrder", "updatedAt") VALUES ('ratepage_digital', v_digital,
      'Flex & Sticker Printing Rates per Sq Ft in Lahore',
      'Pick a flex or sticker, choose the GSM or series, enter your size and see the price at once. Each side is charged to the next full foot.', 2, now())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Sign board items: Normal, Medium, Premium
  FOR r IN SELECT * FROM (VALUES
    ('ratepage_backlit', 'backlit', 'Backlit'), ('ratepage_frontlit', 'frontlit', 'Front-lit')) AS t(page, key, label)
  LOOP
    IF EXISTS (SELECT 1 FROM "RatePage" WHERE id = r.page) THEN
      i := 0;
      FOREACH s IN ARRAY ARRAY['Normal', 'Medium', 'Premium'] LOOP
        INSERT INTO "RateItem" (id, "pageId", name, subtitle, description, "sortOrder", "updatedAt")
        VALUES ('rateitem_' || r.key || '_' || lower(s), r.page,
          CASE s WHEN 'Normal' THEN 'Economy ' WHEN 'Medium' THEN 'Standard ' ELSE 'Premium ' END || r.label || ' Sign Board', s,
          'Write here: the material used, its qualities and benefits, and what it is proof against (for example waterproof, UV resistant, outdoor life).',
          i, now())
        ON CONFLICT (id) DO NOTHING;
        i := i + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- Digital printing: Flex (GSM variants) and Stickers (series variants where relevant)
  IF EXISTS (SELECT 1 FROM "RatePage" WHERE id = 'ratepage_digital') THEN
    i := 0;
    FOR r IN SELECT * FROM (VALUES
      ('china-flex', 'Flex', 'China Flex', 'GSM'),
      ('hd-star-flex', 'Flex', 'HD Star Flex', 'GSM'),
      ('star-flex', 'Flex', 'Star Flex', 'GSM'),
      ('korean-star-flex', 'Flex', 'Korean Star Flex', 'GSM'),
      ('backlit-flex', 'Flex', 'Backlit Flex', 'GSM'),
      ('reflective-flex', 'Flex', 'Reflective Flex', 'GSM'),
      ('vinyl-sticker', 'Stickers', 'Vinyl Sticker', 'SERIES'),
      ('one-way-vision', 'Stickers', 'One Way Vision', 'SERIES'),
      ('reflective-sticker', 'Stickers', 'Reflective Sticker', 'SERIES'),
      ('transparent-sticker', 'Stickers', 'Transparent Sticker', 'NONE'),
      ('matte-sticker', 'Stickers', 'Matte Sticker', 'NONE')) AS t(key, section, name, vtype)
    LOOP
      INSERT INTO "RateItem" (id, "pageId", section, name, description, "variantType", "sortOrder", "updatedAt")
      VALUES ('rateitem_' || r.key, 'ratepage_digital', r.section, r.name,
        'Write here: the material used, its qualities and benefits, and what it is proof against (for example waterproof, UV resistant, outdoor life).',
        r.vtype::"RateVariantType", i, now())
      ON CONFLICT (id) DO NOTHING;
      IF r.vtype = 'GSM' THEN
        FOR g IN 1 .. array_length(gsm, 1) LOOP
          INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES ('ratevar_' || r.key || '_' || gsm[g], 'rateitem_' || r.key, gsm[g] || ' GSM', g)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF r.vtype = 'SERIES' THEN
        FOR g IN 1 .. array_length(series, 1) LOOP
          INSERT INTO "RateVariant" (id, "itemId", label, "sortOrder") VALUES ('ratevar_' || r.key || '_' || g, 'rateitem_' || r.key, series[g], g)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
      i := i + 1;
    END LOOP;
  END IF;
END $rates$;
