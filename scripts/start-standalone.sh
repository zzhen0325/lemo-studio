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
# 强制 HOSTNAME=0.0.0.0：FaaS 平台会注入 HOSTNAME 为 pod 名称，
# Next.js 会将其作为监听地址，导致只绑定 pod name 而非 0.0.0.0，
# FaaS 健康检查探测不到端口 → 30s 超时启动失败。
# 保存原始值供日志等场景使用，但监听地址必须为 0.0.0.0。
export POD_HOSTNAME="${HOSTNAME:-}"
export HOSTNAME="0.0.0.0"

echo "=== Next.js Production Server ==="
echo "PORT: $PORT"
echo "HOSTNAME (listen): $HOSTNAME"
echo "POD_HOSTNAME: $POD_HOSTNAME"
echo "Working directory: $(pwd)"
echo "=================================="

# 启动服务器
exec node server.js
