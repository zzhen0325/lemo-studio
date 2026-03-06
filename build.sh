#!/bin/bash
set -e

echo "进入 server 目录..."
cd server
echo "当前目录: $(pwd)"

echo "安装依赖..."
npm install

echo "构建 Gulux 服务..."
npm run build   # 或 gulux build，看你 server/package.json 里怎么写