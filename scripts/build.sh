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

  bash scripts/check-migrations.sh

  # Migrations need a direct (unpooled) connection: through Neon's connection pooler the
  # migration lock is unreliable, and a sleeping Neon database can take a few seconds to wake.
  # So use the direct URL when there is one, and retry a few times before failing the build.
  MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-}}"
  if [ -z "$MIGRATE_URL" ]; then
    # Neon's pooled host is "<endpoint>-pooler.<region>…"; the direct host is the same without "-pooler".
    MIGRATE_URL="${DATABASE_URL/-pooler./.}"
  fi
  for attempt in 1 2 3 4; do
    if DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy; then
      break
    fi
    if [ "$attempt" = 4 ]; then
      echo "" >&2
      echo "ERROR: database migrations failed 4 times. Migration status:" >&2
      DATABASE_URL="$MIGRATE_URL" npx prisma migrate status >&2 || true
      exit 1
    fi
    echo "Migrations failed (attempt $attempt of 4); retrying in $((attempt * 10))s…" >&2
    sleep $((attempt * 10))
  done

  if [ "${SEED_DEMO_DATA:-}" = "true" ]; then
    echo "SEED_DEMO_DATA=true: loading demo catalog"
    npx prisma db seed
  fi
fi

npx next build
