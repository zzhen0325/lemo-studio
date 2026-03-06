# Deployment Notes

## Server Deployment Record

The Gulux backend deployment was verified on 2026-03-07. The previous root `build.sh` has been preserved as [`scripts/build-server.sh`](../scripts/build-server.sh).

### Server Build Script

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="${REPO_ROOT}/server"
SERVER_OUTPUT_DIR="${SERVER_DIR}/output"
ROOT_OUTPUT_DIR="${REPO_ROOT}/output"

echo "进入 server 目录..."
cd "${SERVER_DIR}"
echo "当前目录: $(pwd)"

echo "安装依赖..."
npm install

echo "构建 Gulux 服务..."
npm run build

echo "同步产物到仓库根目录 output/ ..."
rm -rf "${ROOT_OUTPUT_DIR}"
mkdir -p "${ROOT_OUTPUT_DIR}"
cp -R "${SERVER_OUTPUT_DIR}/." "${ROOT_OUTPUT_DIR}/"

echo "根目录产物已生成: ${ROOT_OUTPUT_DIR}"
```

### Server Deployment Settings

- Install: handled inside `scripts/build-server.sh` with `cd server && npm install`
- Build: handled inside `scripts/build-server.sh` with `cd server && npm run build`
- Start: `cd server && PORT=$PORT NODE_ENV=production gulux start --config server/config`

### Server Required Env

- `MONGODB_URI`
- `MONGODB_DB`
- `API_CONFIG_ENCRYPTION_KEY`

## Frontend Deployment

The root [`build.sh`](../build.sh) now targets the Next.js frontend deployment.

### Frontend Build Script

```bash
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
require('./server.js');
EOF

echo "前端构建完成。部署产物目录: ${FRONTEND_OUTPUT_DIR}"
echo "源码启动命令: NODE_ENV=production next start -p $PORT"
echo "产物启动命令: cd output && NODE_ENV=production node bootstrap.js"
```

### Frontend Deployment Settings

- Install: `npm ci`
- Build: `./build.sh`
- `PRODUCT_OUTPUT_DIR`: `output`
- Start if the platform runs from source checkout: `NODE_ENV=production next start -p $PORT`
- Start if the platform runs packaged artifacts from `output/`: `NODE_ENV=production node bootstrap.js`

### Frontend Packaging Note

The current packaging pipeline shown on 2026-03-07 still executes `cd ${PRODUCT_OUTPUT_DIR}` before packaging metadata, and its default runtime entry is `node bootstrap.js`. Because of that, the frontend build must leave a real `output/` directory behind and include a `bootstrap.js` entry file. The root `build.sh` now assembles a standalone Next.js runtime into `output/` and generates that bootstrap file so product packaging can succeed.

### Frontend Env

- Required for split deployment:
  - `GULUX_API_BASE=https://qzcnzen0.fn-boe.bytedance.net/api`
- Recommended for browser direct requests:
  - `NEXT_PUBLIC_API_BASE=https://qzcnzen0.fn-boe.bytedance.net/api`
- Platform provided:
  - `PORT`

### Cross-Origin Note

If the browser uses `NEXT_PUBLIC_API_BASE` to call the backend origin directly, the backend must also allow the frontend origin:

- `CORS_ALLOW_ORIGINS=https://your-frontend-domain`

If you keep browser requests on same-origin `/api`, `NEXT_PUBLIC_API_BASE` can be left empty and CORS is usually unnecessary.
