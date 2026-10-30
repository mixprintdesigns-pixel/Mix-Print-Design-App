#!/usr/bin/env bash
# Blocks the build if any migration would delete data (DELETE, TRUNCATE, DROP TABLE/COLUMN/SCHEMA).
# A line can be allowed on purpose by ending it with: -- allow-destructive
set -euo pipefail
found=$(grep -n -i -E '^[[:space:]]*(DELETE[[:space:]]+FROM|TRUNCATE|DROP[[:space:]]+(TABLE|SCHEMA|DATABASE))|DROP[[:space:]]+COLUMN' prisma/migrations/*/migration.sql | grep -v -i 'allow-destructive' || true)
if [ -n "$found" ]; then
  echo "ERROR: a migration would delete data. Review it, or mark the line with '-- allow-destructive':" >&2
  echo "$found" >&2
  exit 1
fi
echo "Migration safety check passed: no destructive statements."
