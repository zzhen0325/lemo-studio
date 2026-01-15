#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/cdn-upload-test.log"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  local level="$1"; shift
  local msg="$*"
  printf '[%s] [%s] %s\n' "$(timestamp)" "$level" "$msg" | tee -a "$LOG_FILE"
}

CDN_BASE_URL="${CDN_BASE_URL:-https://ife-cdn.byteintl.net}"
CDN_REGION="${CDN_REGION:-SG}"
CDN_DIR="${CDN_DIR:-ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design}"
CDN_EMAIL="${CDN_EMAIL:-zzhen.0325@bytedance.com}"

log INFO "===== CDN upload test (curl version) start ====="
log INFO "CDN_BASE_URL=$CDN_BASE_URL"
log INFO "CDN_REGION=$CDN_REGION CDN_DIR=$CDN_DIR CDN_EMAIL=$CDN_EMAIL"

TEST_FILE="$REPO_ROOT/public/images/logos/logo.png"
if [ ! -f "$TEST_FILE" ]; then
  if [ -d "$REPO_ROOT/public/1" ]; then
    first_png=$(find "$REPO_ROOT/public/1" -maxdepth 1 -type f -name '*.png' | head -n 1 || true)
    if [ -n "${first_png:-}" ]; then
      TEST_FILE="$first_png"
    fi
  fi
fi

if [ ! -f "$TEST_FILE" ]; then
  log ERROR "No test image found (looked for public/images/logos/logo.png and public/1/*.png)"
  exit 1
fi
log INFO "Using test file: $TEST_FILE"

UPLOAD_URL="${CDN_BASE_URL%/}/cdn/upload"
log INFO "Upload URL: $UPLOAD_URL"

body_file="$(mktemp)"

curl_args=(
  -sS
  -o "$body_file"
  -w '%{http_code}'
  -X POST "$UPLOAD_URL"
  -F "region=$CDN_REGION"
  -F "dir=$CDN_DIR"
  -F "email=$CDN_EMAIL"
  -F "file=@$TEST_FILE"
)

if [ -n "${CDN_TOKEN:-}" ]; then
  curl_args+=( -H "x-cdn-token: $CDN_TOKEN" )
  log INFO "Using x-cdn-token header from CDN_TOKEN env"
fi

set +e
http_code=$(curl "${curl_args[@]}" 2>>"$LOG_FILE")
curl_exit=$?
set -e

body="$(cat "$body_file" 2>/dev/null || echo '')"
rm -f "$body_file" || true

log INFO "HTTP status: ${http_code:-<empty>}"
log INFO "Raw response body: $body"

if [ "$curl_exit" -ne 0 ]; then
  log ERROR "curl failed with exit code $curl_exit; 可能为网络访问受限/证书/代理问题"
  log ERROR "Classification: NETWORK_RESTRICTED"
  exit 1
fi

if [ "$http_code" != "200" ]; then
  log ERROR "Non-200 HTTP status ($http_code); 可能为网络访问受限或服务端错误"
  log ERROR "Classification: HTTP_ERROR_OR_NETWORK"
  exit 1
fi

code=""
cdn_url=""
message=""
if command -v jq >/dev/null 2>&1; then
  code=$(printf '%s' "$body" | jq -r '.code // empty' 2>/dev/null || echo '')
  cdn_url=$(printf '%s' "$body" | jq -r '.cdnUrl // empty' 2>/dev/null || echo '')
  message=$(printf '%s' "$body" | jq -r '.message // empty' 2>/dev/null || echo '')
else
  code=$(printf '%s' "$body" | sed -n 's/.*"code"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1 || echo '')
  cdn_url=$(printf '%s' "$body" | sed -n 's/.*"cdnUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1 || echo '')
  message=$(printf '%s' "$body" | sed -n 's/.*"message"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1 || echo '')
fi

log INFO "Parsed code: ${code:-<empty>} message: ${message:-<empty>}"

if [ "$code" = "0" ]; then
  log INFO "Upload SUCCESS (code=0)."
  if [ -n "$cdn_url" ]; then
    log INFO "CDN URL: $cdn_url"
    printf '[%s] [SUCCESS] cdnUrl=%s\n' "$(timestamp)" "$cdn_url" | tee -a "$LOG_FILE"
  else
    log WARN "code=0 but cdnUrl is empty."
  fi
  exit 0
fi

classification="UNKNOWN_ERROR"
if printf '%s' "$message" | grep -q '该团队空间已被加密'; then
  classification="TEAM_SPACE_ENCRYPTED_NEED_TOKEN"
elif printf '%s' "$message" | grep -q '加密'; then
  classification="TEAM_SPACE_ENCRYPTED_NEED_TOKEN"
elif printf '%s' "$message" | grep -qi 'token'; then
  classification="TEAM_SPACE_ENCRYPTED_NEED_TOKEN_POSSIBLE"
elif printf '%s' "$message" | grep -qi 'network'; then
  classification="NETWORK_RESTRICTED"
fi

log ERROR "Upload FAILED with code=${code:-<empty>} message=${message:-<empty>}"
log ERROR "Classification: $classification"

exit 1
