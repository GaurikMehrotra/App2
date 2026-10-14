#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
database="app2_check_$(date +%s)"
docker exec app2-postgres createdb -U postgres "$database"
trap 'docker exec app2-postgres dropdb -U postgres "$database"' EXIT
# Roles already exist in the shared test server; bootstrap removes role creation.
cat scripts/database-bootstrap.sql | docker exec -i app2-postgres psql -U postgres -d "$database" -v ON_ERROR_STOP=1
for migration in supabase/migrations/*.sql; do docker exec -i app2-postgres psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < "$migration"; done
docker exec -i app2-postgres psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/seed.sql
docker exec -i app2-postgres psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/database-tests.sql
