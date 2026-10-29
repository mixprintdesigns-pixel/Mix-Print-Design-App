#!/usr/bin/env bash
# `npm run build`. On Vercel (VERCEL=1) it first applies database migrations and can load
# the demo catalog; locally it is just `next build`.
set -euo pipefail

if [ -n "${VERCEL:-}" ]; then
  export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}"
  if [ -z "$DATABASE_URL" ]; then
    echo "" >&2
    echo "ERROR: No database connection string found (DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL)." >&2
    echo "Fix: Vercel → your project → Storage → create/connect a Postgres database (e.g. Neon)," >&2
    echo "or add DATABASE_URL under Settings → Environment Variables for Production and Preview." >&2
    echo "Then redeploy from the latest commit." >&2
    exit 1
  fi

  npx prisma migrate deploy

  if [ "${SEED_DEMO_DATA:-}" = "true" ]; then
    echo "SEED_DEMO_DATA=true: loading demo catalog"
    npx prisma db seed
  fi
fi

npx next build
