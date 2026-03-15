#!/bin/bash
set -euo pipefail

HOST_TO_BIND="${BIND_HOST:-${HOST:-${NEXT_HOST:-0.0.0.0}}}"
PORT_TO_BIND="${PORT:-3001}"

export NODE_ENV=production
export HOSTNAME="${HOST_TO_BIND}"
export PORT="${PORT_TO_BIND}"

node .next/standalone/server.js
