#!/usr/bin/env bash
# 本地/CI 验证：在一次性 Postgres 16 容器上应用 shims + migrations + seed。
# 无需 Supabase CLI。用法：bash scripts/verify_db.sh
set -euo pipefail

NAME=kaleido_verify_pg
PORT=${VERIFY_PG_PORT:-55432}

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pw -p "${PORT}:5432" postgres:16 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

echo "waiting for postgres..."
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

export PGPASSWORD=pw
PSQL=(psql -h localhost -p "${PORT}" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f scripts/_verify_shims.sql
"${PSQL[@]}" -f supabase/migrations/0001_schema.sql
"${PSQL[@]}" -f supabase/migrations/0002_rls.sql
"${PSQL[@]}" -f supabase/migrations/0003_storage.sql
"${PSQL[@]}" -f supabase/seed.sql

echo "=== row counts ==="
"${PSQL[@]}" -c "select 'travelers' as t, count(*) from travelers
  union all select 'traveler_details', count(*) from traveler_details
  union all select 'traveler_services', count(*) from traveler_services
  union all select 'bounties', count(*) from bounties;"

echo "=== rls policies ==="
"${PSQL[@]}" -c "select tablename, policyname, cmd from pg_policies order by tablename, policyname;"

echo "VERIFY OK"
