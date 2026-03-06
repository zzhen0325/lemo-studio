#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="${REPO_ROOT}/server"
SERVER_OUTPUT_DIR="${SERVER_DIR}/output"
ROOT_OUTPUT_DIR="${REPO_ROOT}/output"

echo "进入 server 目录..."
cd "${SERVER_DIR}"
echo "当前目录: $(pwd)"

echo "安装依赖..."
npm install

echo "构建 Gulux 服务..."
npm run build

echo "同步产物到仓库根目录 output/ ..."
rm -rf "${ROOT_OUTPUT_DIR}"
mkdir -p "${ROOT_OUTPUT_DIR}"
cp -R "${SERVER_OUTPUT_DIR}/." "${ROOT_OUTPUT_DIR}/"

echo "根目录产物已生成: ${ROOT_OUTPUT_DIR}"
