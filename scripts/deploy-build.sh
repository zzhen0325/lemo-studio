#!/bin/bash
set -e
echo "Installing dependencies..."
pnpm install
echo "Building project..."
# build 脚本已经复制了 static 文件
pnpm run build
echo "Copying additional files to standalone..."
# 复制 public 文件夹
cp -r public .next/standalone/public 2>/dev/null || true
# 复制环境变量文件
cp .env.local .next/standalone/.env.local 2>/dev/null || true
# 复制并设置启动脚本
cp scripts/start-standalone.sh .next/standalone/start.sh
chmod +x .next/standalone/start.sh
echo "Standalone directory ready."
ls -la .next/standalone/
echo "Build complete!"
