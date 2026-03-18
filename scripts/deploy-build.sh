#!/bin/bash
set -e
echo "Installing dependencies..."
pnpm install
echo "Building project..."
# build 脚本已经复制了 static 文件
pnpm run build
echo "Copying additional files to standalone..."
# 复制 public 文件夹内容到 standalone/public（不是作为子目录）
mkdir -p .next/standalone/public
cp -r public/* .next/standalone/public/ 2>/dev/null || true
echo "Public files copied:"
ls -la .next/standalone/public/
# 注意：不复制 .env.local，所有环境变量应通过扣子平台配置
# NEXT_PUBLIC_ 变量在构建时注入，非 PUBLIC 变量在运行时从平台环境读取
# cp .env.local .next/standalone/.env.local 2>/dev/null || true
# 复制并设置启动脚本
cp scripts/start-standalone.sh .next/standalone/start.sh
chmod +x .next/standalone/start.sh
echo "Standalone directory ready."
ls -la .next/standalone/
echo "Build complete!"
