#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-local-proxy}"
APP_PORT="${APP_PORT:-3001}"
DEFAULT_LOCAL_API="http://127.0.0.1:3000/api"
DEFAULT_BOE_API="https://qzcnzen0.fn-boe.bytedance.net/api"

usage() {
  cat <<'EOF'
Usage: ./scripts/dev-frontend.sh <mode>

Modes:
  local-proxy   Frontend uses same-origin /api, proxied to local backend (default)
  boe-proxy     Frontend uses same-origin /api, proxied to BOE backend
  local-direct  Browser calls local backend directly (requires backend CORS)
  custom-proxy  Same-origin /api proxy, requires GULUX_API_BASE to be preset
  custom-direct Browser calls backend directly, requires NEXT_PUBLIC_API_BASE
EOF
}

case "${MODE}" in
  local-proxy)
    export GULUX_API_BASE="${GULUX_API_BASE:-${DEFAULT_LOCAL_API}}"
    export NEXT_PUBLIC_API_BASE=""
    MODE_SUMMARY="same-origin /api -> local backend (${GULUX_API_BASE})"
    ;;
  boe-proxy)
    export GULUX_API_BASE="${GULUX_API_BASE:-${DEFAULT_BOE_API}}"
    export NEXT_PUBLIC_API_BASE=""
    MODE_SUMMARY="same-origin /api -> BOE backend (${GULUX_API_BASE})"
    ;;
  local-direct)
    export GULUX_API_BASE="${GULUX_API_BASE:-${DEFAULT_LOCAL_API}}"
    export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-${DEFAULT_LOCAL_API}}"
    MODE_SUMMARY="browser direct -> local backend (${NEXT_PUBLIC_API_BASE})"
    ;;
  custom-proxy)
    if [[ -z "${GULUX_API_BASE:-}" ]]; then
      echo "custom-proxy 模式需要先设置 GULUX_API_BASE" >&2
      exit 1
    fi
    export NEXT_PUBLIC_API_BASE=""
    MODE_SUMMARY="same-origin /api -> custom backend (${GULUX_API_BASE})"
    ;;
  custom-direct)
    if [[ -z "${NEXT_PUBLIC_API_BASE:-}" ]]; then
      echo "custom-direct 模式需要先设置 NEXT_PUBLIC_API_BASE" >&2
      exit 1
    fi
    export GULUX_API_BASE="${GULUX_API_BASE:-${NEXT_PUBLIC_API_BASE}}"
    MODE_SUMMARY="browser direct -> custom backend (${NEXT_PUBLIC_API_BASE})"
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "不支持的模式: ${MODE}" >&2
    usage >&2
    exit 1
    ;;
esac

export NEXT_PUBLIC_APP_PORT="${APP_PORT}"

echo "[dev-frontend] mode: ${MODE}"
echo "[dev-frontend] frontend: http://127.0.0.1:${APP_PORT}"
echo "[dev-frontend] api: ${MODE_SUMMARY}"
if [[ -n "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  echo "[dev-frontend] NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}"
else
  echo "[dev-frontend] NEXT_PUBLIC_API_BASE=<empty, use same-origin /api>"
fi

cd "${REPO_ROOT}"
exec ./node_modules/.bin/next dev --turbo -H 0.0.0.0 -p "${APP_PORT}"
