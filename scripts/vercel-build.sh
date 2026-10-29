#!/usr/bin/env bash
# Build used by Vercel (package.json "vercel-build"). Applies pending migrations,
# optionally loads the demo catalog, then builds the app.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy." >&2
  exit 1
fi

npx prisma migrate deploy

if [ "${SEED_DEMO_DATA:-}" = "true" ]; then
  echo "SEED_DEMO_DATA=true: loading demo catalog"
  npx prisma db seed
fi

npx next build
