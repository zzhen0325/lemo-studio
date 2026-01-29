#!/usr/bin/env bash

# Lemon8_ai_studio 构建脚本
# 功能：构建 Next.js 前端（仓库根目录）与 Gulux 服务端（server/）

set -euo pipefail
IFS=$'\n\t'

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

log() {
  local level="$1"; shift
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] [$level] $*"
}

log_section() {
  local title="$1"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "[$ts] ====== ${title} ======"
}

print_usage() {
  cat <<EOF
用法: ./${SCRIPT_NAME} [选项]

选项：
  --frontend-only   仅构建前端 (Next.js)
  --server-only     仅构建服务端 (Gulux)
  --skip-install    跳过 npm 依赖安装 (npm ci / npm install)
  -h, --help        显示本帮助并退出

说明：
  - 默认同时构建前端和服务端。
  - 本脚本只负责构建，不会启动任何服务。
  - 要求 Node.js 版本 >= 18。
EOF
}

FRONTEND_ONLY=false
SERVER_ONLY=false
SKIP_INSTALL=false
SERVER_SKIPPED_NO_GULUX=false

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --frontend-only)
        FRONTEND_ONLY=true
        ;;
      --server-only)
        SERVER_ONLY=true
        ;;
      --skip-install)
        SKIP_INSTALL=true
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      *)
        echo "未知参数: $1" >&2
        print_usage
        exit 1
        ;;
    esac
    shift
  done

  if [[ "$FRONTEND_ONLY" == true && "$SERVER_ONLY" == true ]]; then
    echo "错误：不能同时使用 --frontend-only 和 --server-only" >&2
    exit 1
  fi
}

check_node_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo "错误：未检测到 Node.js，请先安装 Node.js 18 或更高版本。" >&2
    exit 1
  fi

  local version major
  # 优先使用 process.versions.node，失败时回退到 node --version
  if version="$(node -p "process.versions.node" 2>/dev/null)"; then
    :
  else
    version="$(node --version 2>/dev/null || true)"
  fi

  if [[ -z "${version}" ]]; then
    echo "错误：无法获取 Node.js 版本信息。" >&2
    exit 1
  fi

  version="${version#v}"
  major="${version%%.*}"

  if ! [[ "${major}" =~ ^[0-9]+$ ]]; then
    echo "错误：无法解析 Node.js 版本: ${version}" >&2
    exit 1
  fi

  if (( major < 18 )); then
    echo "错误：检测到 Node.js 版本 ${version}，本项目要求 Node.js >= 18 (Next.js 15 需要)。" >&2
    exit 1
  fi

  log INFO "使用 Node.js 版本 ${version}"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="${SCRIPT_DIR}"
FRONTEND_DIR="${REPO_ROOT}"
SERVER_DIR="${REPO_ROOT}/server"

validate_project_structure() {
  log_section "检查项目结构"

  if [[ ! -f "${FRONTEND_DIR}/package.json" ]]; then
    echo "错误：未找到前端 package.json，预期路径: ${FRONTEND_DIR}/package.json" >&2
    exit 1
  fi

  if [[ ! -d "${SERVER_DIR}" ]]; then
    echo "错误：未找到服务端目录，预期路径: ${SERVER_DIR}" >&2
    exit 1
  fi

  if [[ ! -f "${SERVER_DIR}/package.json" ]]; then
    echo "错误：未找到服务端 package.json，预期路径: ${SERVER_DIR}/package.json" >&2
    exit 1
  fi

  log INFO "前端目录: ${FRONTEND_DIR}"
  log INFO "服务端目录: ${SERVER_DIR}"
}

run_npm_install() {
  local dir="$1"
  local name="$2"  # 仅用于日志

  if [[ "${SKIP_INSTALL}" == true ]]; then
    log INFO "${name}: 跳过依赖安装 (--skip-install)"
    return
  fi

  if [[ -f "${dir}/package-lock.json" ]]; then
    log INFO "${name}: 检测到 package-lock.json，运行 npm ci"
    (cd "${dir}" && npm ci)
  else
    log INFO "${name}: 未检测到 package-lock.json，回退到 npm install"
    (cd "${dir}" && npm install)
  fi
}

build_frontend() {
  log_section "构建前端 (Next.js)"

  run_npm_install "${FRONTEND_DIR}" "前端"

  log INFO "前端: 运行 npm run build"
  (cd "${FRONTEND_DIR}" && npm run build)

  local output_dir="${FRONTEND_DIR}/.next"
  if [[ -d "${output_dir}" ]]; then
    log INFO "前端构建完成，输出目录: .next"
  else
    log INFO "前端构建完成，但未检测到 .next 目录，请检查构建日志。"
  fi

  # 整理前端构建产物到根级 output 目录，供统一打包使用
  local output_root="${REPO_ROOT}/output"
  mkdir -p "${output_root}"

  if [[ -d "${FRONTEND_DIR}/.next" ]]; then
    cp -R "${FRONTEND_DIR}/.next" "${output_root}" || log WARN "前端: 拷贝 .next 到 output/.next 失败"
  else
    log WARN "前端: 未找到 .next 目录，无法拷贝到 output/.next"
  fi

  if [[ -d "${FRONTEND_DIR}/public" ]]; then
    cp -R "${FRONTEND_DIR}/public" "${output_root}" || log WARN "前端: 拷贝 public 到 output/public 失败"
  fi

  log INFO "打包产物已整理到: ${output_root}"
}

build_server() {
  log_section "构建服务端 (Gulux)"

  local gulux_bin="${SERVER_DIR}/node_modules/.bin/gulux"
  if ! command -v gulux >/dev/null 2>&1 && [[ ! -x "${gulux_bin}" ]]; then
    log WARN "服务端: 未检测到 gulux CLI，跳过服务端构建"
    SERVER_SKIPPED_NO_GULUX=true
    return
  fi

  run_npm_install "${SERVER_DIR}" "服务端"

  log INFO "服务端: 运行 npm run build (gulux build)"
  (cd "${SERVER_DIR}" && npm run build)

  local output_dir="${SERVER_DIR}/output"
  if [[ -d "${output_dir}" ]]; then
    log INFO "服务端构建完成，输出目录: server/output"
  else
    log INFO "服务端构建完成，但未检测到 server/output 目录，请检查构建日志。"
  fi
}

main() {
  parse_args "$@"

  log_section "初始化构建环境"
  validate_project_structure
  check_node_version

  local do_frontend do_server
  if [[ "${FRONTEND_ONLY}" == true ]]; then
    do_frontend=true
    do_server=false
  elif [[ "${SERVER_ONLY}" == true ]]; then
    do_frontend=false
    do_server=true
  else
    do_frontend=true
    do_server=true
  fi

  local frontend_built=false
  local server_built=false

  if [[ "${do_frontend}" == true ]]; then
    build_frontend
    frontend_built=true
  else
    log INFO "前端构建被跳过 (根据参数)。"
  fi

  if [[ "${do_server}" == true ]]; then
    build_server
    server_built=true
  else
    log INFO "服务端构建被跳过 (根据参数)。"
  fi

  echo ""
  echo "================ 构建摘要 ================"
  if [[ "${frontend_built}" == true ]]; then
    echo "- 前端: 已构建 (输出目录: .next)"
  else
    echo "- 前端: 已跳过"
  fi

  if [[ "${SERVER_SKIPPED_NO_GULUX}" == true ]]; then
    echo "- 服务端: 已跳过 (未检测到 gulux CLI)"
  elif [[ "${server_built}" == true ]]; then
    echo "- 服务端: 已构建 (输出目录: server/output)"
  else
    echo "- 服务端: 已跳过"
  fi

  if [[ -d "${REPO_ROOT}/output" ]]; then
    echo "- 打包产物: 已整理 (输出目录: output)"
  fi
  echo "========================================="
}

main "$@"
