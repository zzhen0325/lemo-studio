#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  verify_deploy.sh --frontend <frontend-origin> [--backend <backend-origin-or-api-base>]

Examples:
  verify_deploy.sh --frontend https://pr62hkr9.fn-boe.bytedance.net \
    --backend https://qzcnzen0.fn-boe.bytedance.net
  verify_deploy.sh --frontend https://pr62hkr9.fn-boe.bytedance.net \
    --backend https://qzcnzen0.fn-boe.bytedance.net/api
EOF
}

FRONTEND=""
BACKEND=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend)
      FRONTEND="${2:-}"
      shift 2
      ;;
    --backend)
      BACKEND="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$FRONTEND" ]]; then
  echo "--frontend is required" >&2
  usage >&2
  exit 1
fi

trim_trailing_slash() {
  local value="$1"
  value="${value%/}"
  printf '%s\n' "$value"
}

ensure_api_base() {
  local value
  value="$(trim_trailing_slash "$1")"
  if [[ "$value" != */api ]]; then
    value="${value}/api"
  fi
  printf '%s\n' "$value"
}

FRONTEND="$(trim_trailing_slash "$FRONTEND")"
if [[ -n "$BACKEND" ]]; then
  BACKEND="$(ensure_api_base "$BACKEND")"
fi

run_check() {
  local name="$1"
  local url="$2"
  local mode="${3:-plain}"
  local headers_file
  local body_file
  local http_code
  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  if [[ "$mode" == "compressed" ]]; then
    if ! http_code="$(curl --compressed -sS -D "$headers_file" -o "$body_file" -w '%{http_code}' "$url")"; then
      echo "[FAIL] ${name}: curl decoding/request failed"
      echo "  URL: $url"
      rm -f "$headers_file" "$body_file"
      return 1
    fi
  else
    if ! http_code="$(curl -sS -D "$headers_file" -o "$body_file" -w '%{http_code}' "$url")"; then
      echo "[FAIL] ${name}: request failed"
      echo "  URL: $url"
      rm -f "$headers_file" "$body_file"
      return 1
    fi
  fi

  if [[ "$http_code" != "200" ]]; then
    echo "[FAIL] ${name}: expected 200, got ${http_code}"
    echo "  URL: $url"
    echo "  Response preview:"
    head -c 200 "$body_file" | tr '\n' ' '
    echo
    rm -f "$headers_file" "$body_file"
    return 1
  fi

  echo "[OK] ${name}: ${http_code}"
  echo "  URL: $url"
  rm -f "$headers_file" "$body_file"
}

run_check "frontend-health" "${FRONTEND}/healthz"
run_check "frontend-history-proxy" "${FRONTEND}/api/history?page=1&limit=1&lightweight=1&minimal=1" "compressed"

if [[ -n "$BACKEND" ]]; then
  run_check "backend-view-comfy" "${BACKEND}/view-comfy?lightweight=true"
  run_check "backend-history" "${BACKEND}/history?page=1&limit=1&lightweight=1&minimal=1" "compressed"
else
  echo "[INFO] backend checks skipped (no --backend provided)"
fi
