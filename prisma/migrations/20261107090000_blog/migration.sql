-- Blog: categories, articles (with SEO fields and FAQ), linked products. Add-only: new types and tables.
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

CREATE TABLE "BlogCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorName" TEXT NOT NULL DEFAULT 'Mix Print Design',
    "coverUrl" TEXT,
    "coverAlt" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "focusKeyword" TEXT,
    "canonicalUrl" TEXT,
    "ogImageUrl" TEXT,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
CREATE INDEX "BlogPost_categoryId_idx" ON "BlogPost"("categoryId");
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter categories and one sample Draft article (not shown on the site). Skipped if they already exist.
INSERT INTO "BlogCategory" ("id", "name", "slug", "sortOrder", "updatedAt") VALUES
  ('blogcat_business_cards', 'Business Cards', 'business-cards', 1, CURRENT_TIMESTAMP),
  ('blogcat_sign_boards', 'Sign Boards', 'sign-boards', 2, CURRENT_TIMESTAMP),
  ('blogcat_flex_printing', 'Flex Printing', 'flex-printing', 3, CURRENT_TIMESTAMP),
  ('blogcat_offset_printing', 'Offset Printing', 'offset-printing', 4, CURRENT_TIMESTAMP),
  ('blogcat_customized_printing', 'Customized Printing', 'customized-printing', 5, CURRENT_TIMESTAMP),
  ('blogcat_printing_tips', 'Printing Tips', 'printing-tips', 6, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "BlogPost" ("id", "title", "slug", "excerpt", "content", "categoryId", "tags", "status", "seoTitle", "seoDescription", "focusKeyword", "faqs", "updatedAt") VALUES (
  'blogpost_sample_draft',
  'Business Card Printing in Lahore: A Simple Guide',
  'business-card-printing-guide',
  'Matte or gloss, standard or square? A simple guide to choosing and ordering business cards in Lahore.',
  'Choosing the right business card is the first step to a great first impression. This guide explains the main **business card printing** options we offer in Lahore.

## Paper and finish

Most customers choose between **matte** and **gloss**:

- **Matte**: soft, non-reflective and easy to write on.
- **Gloss**: bright colours and a shiny look.
- **Matte lamination**: extra protection and a premium feel.

## Sizes

| Size | Best for |
| --- | --- |
| 3.5 × 2 in | Standard cards that fit every wallet |
| 2.5 × 2.5 in | Modern square cards |

### Quantity and price

Bigger quantities cost less per card. See our [business cards](/products) for live prices.

> Tip: always check the proof carefully before approving it.

## Order your cards

Choose your options on the product page and press **Order now**, or chat with us on WhatsApp.',
  'blogcat_business_cards',
  ARRAY['business cards', 'lahore'],
  'DRAFT',
  'Business Card Printing in Lahore: A Simple Guide',
  'Matte or gloss, standard or square? A simple guide to choosing paper, size and quantity for business card printing in Lahore.',
  'business card printing',
  '[{"question": "How long does business card printing take?", "answer": "Usually 2 to 3 working days after you approve the proof."}, {"question": "Can you design my card?", "answer": "Yes. Our designers can create a new design or improve your current card."}]',
  CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;
