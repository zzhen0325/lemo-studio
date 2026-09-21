#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
TASK_ROOT="$PWD/.local"
PG_BIN="${LOCAL_POSTGRES_BIN:-$(brew --prefix postgresql@17)/bin}"
PG_PORT=54329
API_PORT=54321
mkdir -p "$TASK_ROOT"
if [[ ! -x "$PG_BIN/pg_ctl" ]] || ! command -v postgrest >/dev/null; then
  echo "Install dependencies first: brew install postgresql@17 postgrest" >&2
  exit 1
fi
if [[ "${1:-up}" == "down" ]]; then
  if [[ -f "$TASK_ROOT/postgrest.pid" ]]; then
    PID="$(cat "$TASK_ROOT/postgrest.pid")"
    if ps -p "$PID" -o args= | grep -F "$TASK_ROOT/postgrest.conf" >/dev/null; then kill "$PID"; fi
    rm -f "$TASK_ROOT/postgrest.pid"
  fi
  if "$PG_BIN/pg_ctl" -D "$TASK_ROOT/postgres" status >/dev/null 2>&1; then
    "$PG_BIN/pg_ctl" -D "$TASK_ROOT/postgres" stop -m fast
  fi
  exit 0
fi
if [[ ! -f "$TASK_ROOT/postgres/PG_VERSION" ]]; then
  "$PG_BIN/initdb" -D "$TASK_ROOT/postgres" -U studio_admin -A trust --locale=C -E UTF8 > "$TASK_ROOT/initdb.log"
fi
if ! "$PG_BIN/pg_ctl" -D "$TASK_ROOT/postgres" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$TASK_ROOT/postgres" -l "$TASK_ROOT/postgres.log" -o "-h 127.0.0.1 -p $PG_PORT -k $TASK_ROOT" start
fi
PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U studio_admin -v ON_ERROR_STOP=1)
if [[ "$("${PSQL[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='studio_local'")" != 1 ]]; then
  "$PG_BIN/createdb" -h 127.0.0.1 -p "$PG_PORT" -U studio_admin studio_local
fi
PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGUSER=studio_admin PGDATABASE=studio_local \
  PSQL_BIN="$PG_BIN/psql" node scripts/db/migrate.mjs apply > "$TASK_ROOT/schema.log"
"${PSQL[@]}" -d studio_local -1 -f lib/server/repositories/local/schema.sql >> "$TASK_ROOT/schema.log"
cat > "$TASK_ROOT/postgrest.conf" <<CONFIG
db-uri = "postgresql://studio_admin@127.0.0.1:$PG_PORT/studio_local"
db-schemas = "public"
db-anon-role = "studio_local"
server-host = "127.0.0.1"
server-port = $API_PORT
CONFIG
RUNNING=false
if [[ -f "$TASK_ROOT/postgrest.pid" ]]; then
  PID="$(cat "$TASK_ROOT/postgrest.pid")"
  if ps -p "$PID" -o args= | grep -F "$TASK_ROOT/postgrest.conf" >/dev/null; then RUNNING=true; fi
fi
if [[ "$RUNNING" == false ]]; then
  nohup postgrest "$TASK_ROOT/postgrest.conf" > "$TASK_ROOT/postgrest.log" 2>&1 < /dev/null &
  echo $! > "$TASK_ROOT/postgrest.pid"
fi
for ATTEMPT in {1..30}; do
  if curl -fsS "http://127.0.0.1:$API_PORT/" -o /dev/null 2>/dev/null; then
    echo 'Local database ready (PostgreSQL 54329, API 54321).'
    exit 0
  fi
  sleep 1
done
cat "$TASK_ROOT/postgrest.log"
exit 1
