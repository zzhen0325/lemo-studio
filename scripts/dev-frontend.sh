#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PORT="${APP_PORT:-3001}"

export NEXT_PUBLIC_APP_PORT="${APP_PORT}"

echo "[dev-frontend] frontend: http://127.0.0.1:${APP_PORT}"
echo "[dev-frontend] api: same-origin /api served by Next.js route handlers"
echo "[dev-frontend] NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-<empty, use same-origin /api>}"

cd "${REPO_ROOT}"
exec ./node_modules/.bin/next dev --turbo -H 0.0.0.0 -p "${APP_PORT}"
