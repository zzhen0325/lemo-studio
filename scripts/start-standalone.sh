#!/bin/bash
# 生产环境启动脚本 - 用于 FaaS 部署
set -e

# 切换到 standalone 目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 加载 .env.local 环境变量（Next.js standalone 模式不会自动加载）
if [ -f ".env.local" ]; then
  echo "Loading .env.local..."
  # 读取并导出环境变量（忽略注释和空行）
  set -a
  while IFS= read -r line || [ -n "$line" ]; do
    # 跳过空行和注释
    case "$line" in
      ''|\#*) continue ;;
    esac
    # 解析 KEY=VALUE 格式
    key="${line%%=*}"
    value="${line#*=}"
    # 移除可能的引号
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    export "$key=$value"
  done < .env.local
  set +a
  echo ".env.local loaded."
fi

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
