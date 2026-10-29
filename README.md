# MixPrint

An online printing store for the Pakistani market: product catalog with volume pricing, multiple product images, a shopping cart, customer accounts, and planned support for custom design requests, proof approvals, order chat, order tracking, JazzCash and Easypaisa payments, and affiliate marketing.

## Status

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Project structure, full database schema, authentication, product catalog, shopping cart, tests | ✅ Done |
| 2 | Checkout, addresses, orders, order tracking, JazzCash / Easypaisa / COD / bank transfer payments | Planned |
| 3 | Artwork uploads, custom design requests, proof approvals, real-time order chat | Planned |
| 4 | Admin dashboard (products, orders, proofs), affiliate program, emails / SMS | Planned |

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/PAYMENTS-PAKISTAN.md](docs/PAYMENTS-PAKISTAN.md).

## Tech stack

- **Next.js 16** (App Router, Server Actions, Cache Components) with **TypeScript**
- **PostgreSQL 16** with **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS 4**
- Custom session authentication: Argon2id password hashing, hashed database sessions, httpOnly cookies
- **Zod** validation
- **Vitest** for unit and database integration tests, **Playwright** for end-to-end browser tests

## Getting started

Requirements: Node.js 22+, PostgreSQL 16.

```bash
npm install                      # also runs prisma generate
cp .env.example .env             # then edit DATABASE_URL
npx prisma migrate deploy        # create tables
npm run db:seed                  # demo catalog + local admin user
npm run dev                      # http://localhost:3000
```

The seed creates a development-only admin account, `admin@mixprint.local` / `ChangeMe12345`. It is skipped when `NODE_ENV=production`.

Databases used locally:

| Database | Used by |
| --- | --- |
| `mixprint` | `npm run dev` |
| `mixprint_test` | `npm test` (wiped between tests, see `.env.test`) |
| `mixprint_e2e` | `npm run test:e2e` (migrated and seeded automatically) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (needs `DATABASE_URL` at build time) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | Browser tests on desktop and mobile (Playwright) |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Load or refresh the demo catalog |

## Project structure

```
prisma/
  schema.prisma          All models: users, catalog, cart, orders, payments, proofs, chat, affiliates
  migrations/            SQL migrations
  seed.ts, seed-data.ts  Demo catalog (prices in paisa)
src/
  app/                   Routes (pages) and Server Actions (app/actions)
  components/            UI components
  lib/
    pricing.ts           Pure pricing rules, shared by server and browser
    auth/                Password hashing, sessions, account service
    cart/                Cart service (database) and cookie handling
    catalog/             Cached catalog queries
    validation.ts        Zod schemas, Pakistani mobile number normalisation
  generated/prisma/      Generated Prisma client (not committed)
tests/
  unit/                  Pure logic
  integration/           Services against a real PostgreSQL database
  e2e/                   Browser tests
scripts/                 Helper scripts (placeholder image generator)
```

## Key design decisions

- **Money is stored as integer paisa** (`125000` = PKR 1,250) to avoid rounding errors. Format with `formatPKR`.
- **Prices are always recalculated on the server.** The product page shows a live price using the same `pricing.ts` code, but the cart reprices every line from the database.
- **Volume pricing:** the highest `PriceTier` at or below the quantity sets the base unit price, then option surcharges (paper, finish, and so on) are added per unit.
- **Sessions:** a 256-bit random token is stored in an httpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored in the database. Sessions expire after 30 days and are deleted on sign-out.
- **Login protection:** after 5 failed attempts an account is locked for 15 minutes. Unknown emails take the same time to reject as wrong passwords.
- **Guest carts:** visitors can shop without an account. On sign-up or sign-in their guest cart is merged into their account cart.
- **Cache Components:** catalog queries use `"use cache"` with a `catalog` cache tag, so the catalog renders from cache. Anything that reads cookies sits inside `<Suspense>`.

## Deploying to Vercel

The app needs a PostgreSQL database at build time as well as at runtime. The catalog pages are prerendered from the database.

1. Create a PostgreSQL database, for example from Vercel → **Storage** → **Neon** (or Supabase / Prisma Postgres). Use the **pooled** connection string.
2. In Vercel → Project → **Settings → Environment Variables**, add:
   - `DATABASE_URL`: the connection string (tick Production and Preview)
   - `SEED_DEMO_DATA` = `true`: optional, loads the demo catalog. Remove it after the first deploy, or later deploys will reset seeded products to the demo data.
3. Redeploy. Vercel runs `npm run vercel-build` (`scripts/vercel-build.sh`), which applies database migrations (`prisma migrate deploy`), optionally seeds, then runs `next build`.

The development admin account is never created in production builds.
