#!/bin/bash
# 生产环境启动脚本
set -e

# 设置端口和主机名
export PORT="${DEPLOY_RUN_PORT:-5000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

echo "Starting Next.js server on ${HOSTNAME}:${PORT}..."

# 切换到 standalone 目录
cd "$(dirname "$0")/../.next/standalone" || {
    echo "Error: .next/standalone directory not found"
    exit 1
}

# 启动服务器
exec node server.js
