# Roadmap

## Stage 1: Foundation ✅

- Next.js 16 + TypeScript + Tailwind project, PostgreSQL + Prisma 7
- Full database schema for every planned feature (one initial migration)
- Registration, sign-in, sign-out, sessions, account lockout, protected account page
- Catalog: categories, search, product pages with multiple images, options, volume pricing, live price
- Cart: guest carts, merge on sign-in, add, update quantity, remove, server-side repricing
- 47 unit/integration tests and 12 end-to-end tests (desktop + mobile)

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
- Affiliate program: referral links and cookies, click tracking, commission on delivered orders, payouts to JazzCash / Easypaisa
- Email verification, password reset, SMS/WhatsApp notifications
- SEO (sitemap, structured data), analytics, Urdu localisation
- Production deployment (Vercel / Railway / VPS) with a managed PostgreSQL database and backups
