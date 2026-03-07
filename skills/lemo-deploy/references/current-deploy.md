# Lemon8 AI Studio Deployment Summary

## Use This Reference For

- updating frontend or backend deployment commands
- checking required environment variables
- verifying a live BOE deployment after changes
- debugging common deployment/runtime failures

## Frontend

- Build script: `./build.sh`
- Product output dir: `output`
- Start: `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`
- Health: `/healthz`
- Required env: `GULUX_API_BASE=https://qzcnzen0.fn-boe.bytedance.net/api`
- Optional env: `NEXT_PUBLIC_API_BASE`

Default recommendation:

- keep browser requests on same-origin `/api`
- do not rely on `NEXT_PUBLIC_API_BASE` unless direct browser calls are required

## Backend

- Build script: `./scripts/build-server.sh`
- Start: `cd server && PORT=$PORT NODE_ENV=production gulux start --config server/config`
- Required env:
  - `MONGODB_URI`
  - `MONGODB_DB`
  - `API_CONFIG_ENCRYPTION_KEY`

## Verification URLs

- Frontend health: `/healthz`
- Frontend proxy: `/api/history?page=1&limit=1&lightweight=1&minimal=1`
- Backend direct:
  - `/api/view-comfy?lightweight=true`
  - `/api/history?page=1&limit=1&lightweight=1&minimal=1`

## Common Failure Patterns

### `EADDRNOTAVAIL`

- Cause: runtime injected an IPv6 `HOSTNAME` that was not bindable
- Fix: start with `HOSTNAME=0.0.0.0` or rely on generated `bootstrap.js`

### `ERR_CONTENT_DECODING_FAILED`

- Cause: stale frontend proxy deployment forwarding mismatched compression headers
- Fix: redeploy frontend after the proxy fix in `app/api/[...path]/route.ts`

### CORS

- Only needed when the browser directly calls the backend domain
- Backend env format:
  - `CORS_ALLOW_ORIGINS=https://<frontend-domain>`
