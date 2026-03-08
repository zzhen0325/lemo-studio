#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="${REPO_ROOT}/server"
SERVER_OUTPUT_DIR="${SERVER_DIR}/output"
ROOT_OUTPUT_DIR="${REPO_ROOT}/output"

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

echo "进入 server 目录..."
cd "${SERVER_DIR}"
echo "当前目录: $(pwd)"

echo "安装依赖..."
npm install

echo "构建 Gulux 服务..."
npm run build

copy_runtime_support_files "${SERVER_OUTPUT_DIR}"

echo "同步产物到仓库根目录 output/ ..."
rm -rf "${ROOT_OUTPUT_DIR}"
mkdir -p "${ROOT_OUTPUT_DIR}"
cp -R "${SERVER_OUTPUT_DIR}/." "${ROOT_OUTPUT_DIR}/"

echo "根目录产物已生成: ${ROOT_OUTPUT_DIR}"
