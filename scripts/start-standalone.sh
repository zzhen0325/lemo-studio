#!/bin/bash
# 生产环境启动脚本 - 用于 FaaS 部署
set -e

# 切换到 standalone 目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 注意：环境变量由扣子平台注入，无需手动加载 .env.local
# - NEXT_PUBLIC_ 变量已在构建时编译到代码中
# - 非 PUBLIC 变量由平台在运行时注入

# 设置端口（优先使用 FaaS 平台注入的环境变量）
export PORT="${DEPLOY_RUN_PORT:-${PORT:-5000}}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

echo "=== Next.js Production Server ==="
echo "PORT: $PORT"
echo "HOSTNAME: $HOSTNAME"
echo "Working directory: $(pwd)"
echo "=================================="

# 启动服务器
exec node server.js
