# Deployment Notes

## Quick Reference

### Frontend (Next.js)

- Build script: `./build.frontend.sh`
- Compatibility alias: `./build.sh`
- Packaging output dir: `output`
- Start command: `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`
- Health check path: `/healthz`
- Required env: `GULUX_API_BASE`
- Optional env: `NEXT_PUBLIC_API_BASE`

### Backend (Gulux server)

- Build script: `./build.backend.sh`
- Compatibility target: `./scripts/build-server.sh`
- Start command: `cd server && PORT=$PORT NODE_ENV=production gulux start --config server/config`
- Required env:
  - `MONGODB_URI`
  - `MONGODB_DB`
  - `API_CONFIG_ENCRYPTION_KEY`

## Deployment Scripts

### Frontend Script

File: `build.sh`

Compatibility alias to `build.frontend.sh`.

File: `build.frontend.sh`

Responsibilities:

- Run `npm ci`
- Run `npm run build`
- Copy `.next/standalone`, `.next/static`, and `public/` into `output/`
- Generate `output/bootstrap.js` for packaged runtime startup

Why the bootstrap file exists:

- Product packaging still expects `output/`
- Runtime startup still defaults to `node bootstrap.js`
- Some Node/FaaS runtimes inject an IPv6 `HOSTNAME` that is not bindable, so the bootstrap normalizes that case to `0.0.0.0`

### Backend Script

File: `scripts/build-server.sh`

Wrapped by root `build.backend.sh`.

Responsibilities:

- Enter `server/`
- Run `npm install`
- Run `npm run build`
- Copy `server/output/` back to root `output/`

## Runtime Model

### Recommended Frontend API Mode

Use same-origin `/api/*` on the frontend.

- Browser requests: `https://<frontend-domain>/api/*`
- Frontend proxy target: `GULUX_API_BASE=https://qzcnzen0.fn-boe.bytedance.net/api`

This is the preferred mode because:

- it does not depend on `NEXT_PUBLIC_API_BASE` being injected at build time
- it avoids backend CORS requirements
- the browser never needs to call the backend domain directly
- it matches the local debug scripts `npm run dev` and `npm run dev:proxy:boe`

### Direct Browser Backend Calls

Only use direct browser calls when you explicitly need them.

Requirements:

- set `NEXT_PUBLIC_API_BASE=https://qzcnzen0.fn-boe.bytedance.net/api` at build time
- set backend `CORS_ALLOW_ORIGINS=https://<frontend-domain>`

If the browser requests `https://<frontend-domain>/api/*`, that is expected and correct in proxy mode.

## Recommended Platform Configuration

### Frontend

- Build command: `./build.sh`
- Preferred explicit build command: `./build.frontend.sh`
- `PRODUCT_OUTPUT_DIR`: `output`
- Start command: `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`
- Health check path: `/healthz`
- Auto-install npm dependencies: off

### Backend

- Build command: `./scripts/build-server.sh`
- Preferred explicit build command: `./build.backend.sh`
- Start command: `cd server && PORT=$PORT NODE_ENV=production gulux start --config server/config`

## Verification

### Frontend

- Health:
  - `https://<frontend-domain>/healthz`
- Proxy path:
  - `https://<frontend-domain>/api/history?page=1&limit=1&lightweight=1&minimal=1`

### Backend

- `https://qzcnzen0.fn-boe.bytedance.net/api/view-comfy?lightweight=true`
- `https://qzcnzen0.fn-boe.bytedance.net/api/history?page=1&limit=1&lightweight=1&minimal=1`

### Helper Script

Run:

```bash
./skills/lemo-deploy/scripts/verify_deploy.sh \
  --frontend https://<frontend-domain> \
  --backend https://qzcnzen0.fn-boe.bytedance.net
```

## Known Issues

### `EADDRNOTAVAIL`

Symptom:

- runtime startup fails while binding an IPv6 `HOSTNAME`

Fix:

- use `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`

### `ERR_CONTENT_DECODING_FAILED`

Symptom:

- browser requests to frontend `/api/history` or similar return `200`, but decoding fails

Cause:

- the frontend proxy forwarded mismatched compression headers

Fix:

- redeploy frontend with the latest proxy fix in `app/api/[...path]/route.ts`

### CORS Confusion

Symptom:

- the browser appears to call the frontend domain instead of the backend domain

Interpretation:

- this is normal in same-origin proxy mode

Only configure backend `CORS_ALLOW_ORIGINS` when the browser directly calls the backend domain.
