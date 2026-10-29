# Categories, Services and SEO

## One category tree for Services and Products
Both the **Services** and **Products** pages read the same `Category` table:

```
Main service → Category → Sub-category → … (any depth) → Products
```

- **Main services:** Board Maker, Offset Printing, Digital Printing, Customized Printing.
- **Starting tree:** the full set of categories (with short and long descriptions) is created by the migration
  `prisma/migrations/20261102090000_shared_category_tree`. It is generated from `prisma/taxonomy/*.ts` by
  `scripts/generate-taxonomy-sql.ts`. Running it again never overwrites a category the owner has already edited.
- **Admin → Categories & Services:**
  - add a category at any level ("+ Sub");
  - edit the name, slug, short description, page description (100–200 words recommended), starting price and unit, image and alt text, SEO title and description;
  - reorder (↑ ↓), show/hide, or delete.
  - Hiding a category also hides everything inside it.
- **Prices:** set a starting price (e.g. `45` + `per sq. ft`) to show "From PKR 45 per sq. ft". If the price is empty, the page shows **Get Quote** with WhatsApp.
- **Products:** choose any category in the product editor. The product then appears automatically:
  - in that category,
  - in every parent category's listing (a parent includes its sub-categories),
  - on the matching Services page.
- **Images:** uploads (categories and products) are converted to WebP, resized to at most 1600 px wide, and saved with a descriptive file name (e.g. `categories/3d-sign-board-1a2b3c.webp`). Pages use `next/image`, which lazy-loads images and serves modern formats. Categories without an image show a coloured placeholder.

## URLs
| Page | Example |
| --- | --- |
| Service (category view) | `/services/board-maker/3d-sign-board` |
| Product listing for a category (includes sub-categories) | `/products/offset-printing/business-cards` |
| Product | `/products/offset-printing/business-cards/standard-business-cards` |

- Old links such as `/products?category=business-cards` redirect with **301** to the new URL (`src/proxy.ts`).
- Old one-segment product links (`/products/<product>`) still open, with the canonical tag pointing to the new URL.
- The Business cards and Marketing header shortcuts were removed. Their old links redirect (Marketing → `/products`).

## SEO
- **Titles and descriptions:** every page has a unique title and meta description.
  - Category default: e.g. "Matte Business Cards Printing in Lahore | Mix Print Design".
  - Override per category or product in its edit form.
  - Home, Products, Services, About, Contact and Earn with us: Admin → SEO.
- **Canonical tags:** on every public page. Search, sort and filter URLs (`?q=`, `?sort=`) point to the clean URL.
- **Open Graph and Twitter cards:** a default share image is `public/og-image.png`. Categories and products use their own image.
- **Structured data (JSON-LD):**
  - LocalBusiness: on every page; on the home page it also includes reviews and the aggregate rating.
  - BreadcrumbList: on every catalog page.
  - Product: price range in PKR and availability.
  - Service: on category pages.
- **One H1 per page**, breadcrumbs, related categories and related products for internal linking.
- **`/sitemap.xml`:** all pages, categories (both views) and published products. It updates when the catalog changes.
- **`/robots.txt`:** blocks admin, cart, checkout, account, login/register, API and private affiliate pages. Those pages also carry `noindex`.
- **404 page:** links back to the main services. Unknown catalog URLs show it with `noindex`.
- **Pre-rendering:** all category and product pages are pre-rendered at build time. New ones are generated on their first visit and refreshed when the admin saves a change.
- **`APP_URL`:** set it to the live domain (e.g. `https://mixprintdesign.com`) so canonical links, the sitemap and structured data use it. On Vercel the production domain is used if `APP_URL` is not set.

### Submit the sitemap to Google Search Console
1. Open https://search.google.com/search-console and click **Add property**.
2. Choose **Domain**, enter your domain, and add the DNS TXT record it shows at your domain registrar. Alternatively, choose **URL prefix** and verify with the HTML tag or file method.
3. After verification, open **Sitemaps** in the left menu.
4. Enter `sitemap.xml` and click **Submit**.
5. Use **URL Inspection** → **Request indexing** for the most important pages (home, /services, main categories).

## Older data
The earlier separate services tables (`ServiceCategory`, `ServiceSubtype`, `ServiceQuality`) and the `Product.service*` columns were copied into the category tree by the migration. They are no longer used by the app. They are kept so no data is lost and can be dropped in a later cleanup migration.
