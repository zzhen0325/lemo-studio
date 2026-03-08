#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_OUTPUT_DIR="${REPO_ROOT}/output"

echo "进入前端项目目录..."
cd "${REPO_ROOT}"
echo "当前目录: $(pwd)"

echo "安装前端依赖..."
npm ci

echo "构建 Next.js 前端..."
npm run build

echo "整理前端部署产物到 output/ ..."
rm -rf "${FRONTEND_OUTPUT_DIR}"
mkdir -p "${FRONTEND_OUTPUT_DIR}/.next"
cp -R .next/standalone/. "${FRONTEND_OUTPUT_DIR}/"
cp -R .next/static "${FRONTEND_OUTPUT_DIR}/.next/static"
cp -R public "${FRONTEND_OUTPUT_DIR}/public"

cat > "${FRONTEND_OUTPUT_DIR}/bootstrap.js" <<'EOF'
process.chdir(__dirname);

const { isIP } = require('node:net');
const explicitHost = process.env.BIND_HOST || process.env.HOST || process.env.NEXT_HOST;
const rawHostname = typeof process.env.HOSTNAME === 'string' ? process.env.HOSTNAME.trim() : '';
const isIpLiteral = rawHostname ? isIP(rawHostname) > 0 : false;

// Next standalone reads process.env.HOSTNAME directly. Some runtimes inject an
// IPv6 address that is not actually bindable inside the container, so we force
// a safe wildcard host unless an explicit bind host was provided.
if (explicitHost) {
  process.env.HOSTNAME = explicitHost;
} else if (!rawHostname || isIpLiteral) {
  process.env.HOSTNAME = '0.0.0.0';
}

require('./server.js');
EOF

echo "前端构建完成。部署产物目录: ${FRONTEND_OUTPUT_DIR}"
echo "源码启动命令: NODE_ENV=production next start -p \$PORT"
echo "产物启动命令: cd output && NODE_ENV=production node bootstrap.js"
