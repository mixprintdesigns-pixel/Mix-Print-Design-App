-- Sign Board Maker structure (owner request, 30 Oct 2026). Add and update only: nothing is deleted.
-- 1. Dated backup of the category table inside the database.
CREATE TABLE IF NOT EXISTS "_backup_Category_20261030" AS SELECT * FROM "Category";

-- Text is only rewritten on categories the owner has not edited in admin (createdAt = updatedAt).
CREATE OR REPLACE FUNCTION pg_temp.mp_upsert_cat(p_parent text, p_slug text, p_name text, p_short text, p_content text, p_sort int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_id text;
BEGIN
  SELECT id INTO v_id FROM "Category" WHERE "parentId" = p_parent AND slug = p_slug;
  IF v_id IS NULL THEN
    v_id := 'cat_' || substr(md5(p_parent || '/' || p_slug), 1, 20);
    INSERT INTO "Category" (id, name, slug, description, content, "sortOrder", "parentId", "createdAt", "updatedAt")
    VALUES (v_id, p_name, p_slug, p_short, p_content, p_sort, p_parent, now(), now());
  ELSE
    UPDATE "Category" SET name = p_name, description = p_short, content = p_content, "sortOrder" = p_sort,
      "updatedAt" = "createdAt"
    WHERE id = v_id AND "createdAt" = "updatedAt";
  END IF;
  RETURN v_id;
END $$;

DO $sbm$
DECLARE
  v_board text; v_3d text; v_backlit text; v_frontlit text;
BEGIN
  SELECT id INTO v_board FROM "Category" WHERE "parentId" IS NULL AND slug = 'board-maker';
  IF v_board IS NULL THEN RETURN; END IF;

  -- 2. "Board Maker" is now "Sign Board Maker" (the web address /services/board-maker stays the same).
  UPDATE "Category" SET name = 'Sign Board Maker', "updatedAt" = "createdAt"
    WHERE id = v_board AND "createdAt" = "updatedAt";

  SELECT id INTO v_3d FROM "Category" WHERE "parentId" = v_board AND slug = '3d-sign-board';
  SELECT id INTO v_backlit FROM "Category" WHERE "parentId" = v_board AND slug = 'backlit-sign-board';
  SELECT id INTO v_frontlit FROM "Category" WHERE "parentId" = v_board AND slug = 'front-lit-sign-board';

  -- Order: 3D Sign Board, Backlit, Front-lit.
  UPDATE "Category" SET "sortOrder" = CASE slug WHEN '3d-sign-board' THEN 0 WHEN 'backlit-sign-board' THEN 1 ELSE 2 END
    WHERE "parentId" = v_board AND slug IN ('3d-sign-board', 'backlit-sign-board', 'front-lit-sign-board') AND "createdAt" = "updatedAt";

  -- 3. 3D Sign Board types.
  IF v_3d IS NOT NULL THEN
    PERFORM pg_temp.mp_upsert_cat(v_3d, 'simple-sign', 'Simple Acrylic Sign',
      'Clean, budget-friendly acrylic signs with cut letters for shops, offices and clinics.',
      'A simple acrylic sign gives your shop or office a neat, professional name board without a big budget. Your name is cut from coloured acrylic sheet and fixed to the wall or to a backing panel, so the letters stand out with a light 3D edge.

Simple acrylic signs suit small shops, clinics, salons, offices and reception walls in Lahore. Choose the acrylic colour, letter height and font, and we prepare a design proof before cutting. Acrylic is light, weather-resistant and easy to clean, so the sign keeps its shine for years.

Send us your shop name, logo and the wall size on WhatsApp. Mix Print Design makes and installs acrylic signs across Lahore and can deliver ready-to-fix signs anywhere in Pakistan.', 0);

    PERFORM pg_temp.mp_upsert_cat(v_3d, 'acrylic-logo-board', 'Logo Board with Acrylic Sign',
      'A printed or painted logo board with raised acrylic letters for a complete brand front.',
      'A logo board with acrylic sign combines a backing board, such as ACP, PVC or wood, with raised acrylic letters and your logo. The board frames your brand, while the acrylic letters add depth and a premium finish that is easy to read from the road.

This style is popular for shop fronts, showrooms, offices and reception areas in Lahore. We can print or cut your logo in full colour, match your brand colours and add LED lighting for night visibility.

Share your logo, shop name and board size on WhatsApp. Mix Print Design designs, makes and installs logo boards across Lahore and delivers to cities throughout Pakistan.', 1);

    PERFORM pg_temp.mp_upsert_cat(v_3d, 'frame-acrylic-sign', 'Frame with Acrylic Sign',
      'Acrylic letters mounted inside a neat metal or aluminium frame for a premium shop front.',
      'A frame with acrylic sign places your acrylic letters and logo inside a clean metal or aluminium frame. The frame gives the sign sharp edges, protects the board and makes the whole shop front look finished and premium.

Framed acrylic signs are a favourite for showrooms, boutiques, restaurants, pharmacies and corporate offices in Lahore. Choose the frame colour (silver, black or gold), the backing board and the acrylic colours, and add LED lighting if you want the sign to glow at night.

Send us a photo of your shop front with the size on WhatsApp. Mix Print Design measures, makes and installs framed acrylic signs in Lahore and ships across Pakistan.', 2);

    PERFORM pg_temp.mp_upsert_cat(v_3d, 'aluminium-sign', 'Aluminium with Acrylic Sign',
      'Strong aluminium (ACP) boards with acrylic letters, built for outdoor shop fronts.',
      'An aluminium with acrylic sign uses an aluminium composite (ACP) panel as the base, with acrylic letters and logo fixed on top. ACP is light, rigid and weatherproof, so the sign stays flat and smart through sun and rain, while the acrylic letters give a clear, raised look.

This is one of the most popular outdoor sign types for shops, markets, plazas and offices in Lahore and across Pakistan. Choose the panel colour, letter colours and sizes, and add front or back LED lighting for night visibility.

Tell us your shop name and board size on WhatsApp. Mix Print Design makes and installs aluminium and acrylic signs in Lahore, with delivery across Pakistan.', 3);

    UPDATE "Category" SET "sortOrder" = 4 WHERE "parentId" = v_3d AND slug = 'glitter-sign';

    -- Types not in the new list are hidden (not deleted); they can be shown again in admin.
    UPDATE "Category" SET "isVisible" = false
      WHERE "parentId" = v_3d AND slug IN ('2d-sign', '3d-sign', 'ss-stainless-steel-sign');
  END IF;

  -- 4. Backlit and Front-lit: Normal, Medium, Premium.
  IF v_backlit IS NOT NULL THEN
    PERFORM pg_temp.mp_upsert_cat(v_backlit, 'normal', 'Normal Backlit Sign Board',
      'An affordable backlit flex board with LED lights inside, ideal for everyday shop fronts.',
      'A normal backlit sign board is the most economical way to keep your shop visible at night. Your design is printed on backlit flex, stretched over an iron frame and lit from inside with LED lights, so the whole board glows evenly after dark.

It is a practical choice for new shops, small businesses, pharmacies, general stores and food points in Lahore. The board is made to your size, and we install it at your shop.

Send us your shop name, logo and board size on WhatsApp for a quote. Mix Print Design makes and installs backlit boards across Lahore and supplies businesses throughout Pakistan.', 0);
    PERFORM pg_temp.mp_upsert_cat(v_backlit, 'medium', 'Medium Backlit Sign Board',
      'Brighter backlit boards with better flex, more LEDs and a sturdier frame.',
      'A medium backlit sign board steps up from the normal board with better-quality backlit flex, more LED modules for brighter, more even light and a stronger frame. Colours look richer and the board stays bright for longer.

It suits busy markets, restaurants, salons, showrooms and shops on main roads in Lahore where the sign competes with many others at night. We make the board to your size and install it for you.

Share your design or logo and the board size on WhatsApp. Mix Print Design builds medium backlit boards for shops across Lahore and Pakistan.', 1);
    PERFORM pg_temp.mp_upsert_cat(v_backlit, 'premium', 'Premium Backlit Sign Board',
      'Top-grade backlit boards with premium media, branded LEDs and an aluminium frame.',
      'A premium backlit sign board uses top-grade backlit media, branded LED modules and a slim aluminium frame for the brightest, most even glow and a clean, modern look. It is built to last for years with steady colour and light.

Premium backlit boards suit brands, franchises, showrooms, hospitals, schools and flagship stores in Lahore that want a high-end shop front. Ask us about matching your brand colours exactly and adding acrylic or 3D letters on top.

Message us your design and size on WhatsApp. Mix Print Design makes and installs premium backlit boards across Lahore, with service throughout Pakistan.', 2);
  END IF;

  IF v_frontlit IS NOT NULL THEN
    PERFORM pg_temp.mp_upsert_cat(v_frontlit, 'normal', 'Normal Front-lit Sign Board',
      'An economical front-lit flex board with lights mounted above, for everyday signage.',
      'A normal front-lit sign board is a printed flex board lit from the front by lights mounted above it. It is the most economical outdoor sign and a quick way to brand a new shop, office or site.

It suits small shops, offices, schools, clinics and temporary sites in Lahore. The board is made to your size on an iron frame and installed at your location.

Send your shop name, logo and board size on WhatsApp for a quote. Mix Print Design makes and installs front-lit boards in Lahore and supplies them across Pakistan.', 0);
    PERFORM pg_temp.mp_upsert_cat(v_frontlit, 'medium', 'Medium Front-lit Sign Board',
      'Front-lit boards with sharper print, better flex and stronger lights.',
      'A medium front-lit sign board uses better-quality flex with sharper printing, a stronger frame and brighter LED flood or spot lights. Colours stay vivid in sunlight and the board reads clearly at night.

It is a good fit for shops on main roads, markets, restaurants and showrooms in Lahore. We make the board to your size and install the lights for an even spread.

Share your design or logo and the size on WhatsApp. Mix Print Design builds medium front-lit boards across Lahore and Pakistan.', 1);
    PERFORM pg_temp.mp_upsert_cat(v_frontlit, 'premium', 'Premium Front-lit Sign Board',
      'Premium front-lit boards with high-definition print, ACP framing and quality lights.',
      'A premium front-lit sign board combines high-definition printing on premium media with a neat ACP or aluminium frame and quality LED lights. The result is a sharp, long-lasting board that looks professional by day and night.

Premium front-lit boards suit brands, franchises, offices and showrooms in Lahore that want a clean, high-end look. We can add acrylic or 3D letters for extra depth.

Message us your design and board size on WhatsApp. Mix Print Design makes and installs premium front-lit boards in Lahore and across Pakistan.', 2);
  END IF;
END $sbm$;
