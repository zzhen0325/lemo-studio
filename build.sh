#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "进入前端项目目录..."
cd "${REPO_ROOT}"
echo "当前目录: $(pwd)"

echo "安装前端依赖..."
npm ci

echo "构建 Next.js 前端..."
npm run build

echo "前端构建完成。启动命令: NODE_ENV=production next start -p \$PORT"
