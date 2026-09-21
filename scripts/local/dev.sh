#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bash scripts/local/services.sh up
export STUDIO_RUNTIME=local
export APP_PORT="${APP_PORT:-3001}"
export LOCAL_DATABASE_API_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_BASE_URL="http://127.0.0.1:$APP_PORT"
export NEXT_PUBLIC_API_BASE=''
export LOCAL_STORAGE_DIR="$PWD/.local/objects"
export APP_HOST=127.0.0.1
exec bash scripts/dev-frontend.sh
