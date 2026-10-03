#!/usr/bin/env bash
# Applies every migration + seed to a throwaway local PostgreSQL database and runs SQL assertions.
# Requires a local PostgreSQL (16+) server. Usage: npm run db:test
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${HN_TEST_DB:-herbanatura_test}
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
echo "→ supabase/seed.sql"
"${PSQL[@]}" -d "$DB" -f supabase/seed.sql
echo "→ supabase/tests/assertions.sql"
"${PSQL[@]}" -d "$DB" -o /dev/null -f supabase/tests/assertions.sql
echo "OK: migrations, seed and assertions passed on $DB"
