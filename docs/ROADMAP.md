# Roadmap

## Stage 1: Foundation ✅

- Next.js 16 + TypeScript + Tailwind project, PostgreSQL + Prisma 7
- Full database schema for every planned feature (one initial migration)
- Registration, sign-in, sign-out, sessions, account lockout, protected account page
- Catalog: categories, search, product pages with multiple images, options, volume pricing, live price
- Cart: guest carts, merge on sign-in, add, update quantity, remove, server-side repricing
- 47 unit/integration tests and 12 end-to-end tests (desktop + mobile)

## Stage 1b: Catalog management ✅

- Admin dashboard with role checks; products, images (upload, main image, reorder, delete) and categories with subcategories
- Product SKUs, publication status, availability, SEO fields, per-product affiliate commission
- Pricing rules: quantity tiers, bulk discounts, option surcharges per unit or once per order
- Storefront: category tree, subcategory chips, sorting, production-time and availability filters, SKU search
- Cart: change a line's options (merges with an identical line)
- Image storage on local disk (development) or Vercel Blob (production)

## Stage 1c: Affiliate module ✅

- Public program page, home page section, header and footer links
- Application with JazzCash / Easypaisa / IBAN payout details; admin approve, reject, suspend, custom rates
- Referral links (`/r/CODE`, product links), click tracking with de-duplication, 30-day cookie
- Commission engine (product → affiliate → default rate), reversal on cancel/refund, approval after hold period
- Affiliate dashboard: links, clicks, orders, conversion, sales, balances, commissions, withdrawals, payout details
- Admin: affiliates, commissions, withdrawals (mark paid with reference / reject), program settings
- Waiting on checkout (stage 2) to create commissions from real orders. See docs/AFFILIATES.md

## Stage 2: Checkout, orders and payments

- Address book (Pakistani provinces and cities), delivery charges by city
- Checkout that turns a cart into an `Order` with price snapshots and an order number
- Payment adapters: JazzCash, Easypaisa, cash on delivery, bank transfer (see `PAYMENTS-PAKISTAN.md`)
- Order history and order tracking timeline (`OrderStatusEvent`), courier and tracking number
- Order confirmation email

## Stage 3: Design, proofs and chat

- Artwork upload per order item (local disk in development, S3 / Cloudflare R2 in production), with file type and size checks
- Custom design requests with briefs, reference files and quotes
- Proof versions: staff upload, customer approves or requests changes; production starts only after approval
- Real-time order and design chat (WebSocket server or Server-Sent Events with PostgreSQL LISTEN/NOTIFY or Redis pub/sub), unread counts, attachments

## Stage 4: Admin and growth

- Admin dashboard: products (images, options, tiers), orders, status updates, proofs, payments
- Role-based access (`STAFF`, `ADMIN`) enforced in every action
- Email verification, password reset, SMS/WhatsApp notifications
- SEO (sitemap, structured data), analytics, Urdu localisation
- Production deployment (Vercel / Railway / VPS) with a managed PostgreSQL database and backups
