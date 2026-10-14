#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
created=false
if ! docker container inspect app2-postgres >/dev/null 2>&1; then
  docker run -d --name app2-postgres --label app2.test=true -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
  created=true
fi
cleanup() { if "$created"; then docker rm -f app2-postgres >/dev/null; fi; }
trap cleanup EXIT
for attempt in {1..30}; do
  if docker exec app2-postgres pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
bash scripts/check-db.sh
