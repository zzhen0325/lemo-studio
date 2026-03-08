#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_OUTPUT_DIR="${REPO_ROOT}/output"

copy_runtime_support_files() {
  local target_dir="$1"

  echo "复制运行时 manifest 与工作流模板..."

  while IFS= read -r -d '' source_file; do
    local relative_path="${source_file#${REPO_ROOT}/}"
    local destination_file="${target_dir}/${relative_path}"
    mkdir -p "$(dirname "${destination_file}")"
    cp "${source_file}" "${destination_file}"
  done < <(find "${REPO_ROOT}/config" -type f -name '*.json' -print0)

  if [ -d "${REPO_ROOT}/workflows/templates" ]; then
    mkdir -p "${target_dir}/workflows"
    cp -R "${REPO_ROOT}/workflows/templates" "${target_dir}/workflows/"
  fi
}

prune_legacy_local_assets() {
  local target_dir="$1"
  local public_dir="${target_dir}/public"

  if [ ! -d "${public_dir}" ]; then
    return
  fi

  echo "剔除历史本地资源目录..."

  rm -rf \
    "${public_dir}/avatars" \
    "${public_dir}/dataset" \
    "${public_dir}/outputs" \
    "${public_dir}/styles" \
    "${public_dir}/tools" \
    "${public_dir}/upload"

  if [ -d "${public_dir}/preset" ]; then
    find "${public_dir}/preset" -maxdepth 1 -type f ! -name 'categories.json' -delete
  fi
}

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
prune_legacy_local_assets "${FRONTEND_OUTPUT_DIR}"
copy_runtime_support_files "${FRONTEND_OUTPUT_DIR}"

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
