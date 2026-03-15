#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

exec "${REPO_ROOT}/build.frontend.sh"
