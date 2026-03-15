# Deployment Notes

## Runtime Model

- Deploy a single Next.js Node service.
- UI pages and `/api/*` route handlers run inside the same process.
- MongoDB, CDN, ComfyUI, ViewComfy, and AI providers remain external dependencies configured by env vars.

## Build And Start

- Build script: `./build.frontend.sh`
- Compatibility alias: `./build.sh`
- Output dir: `output`
- Start command: `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`
- Health check: `/healthz`

`build.frontend.sh` packages:

- `.next/standalone`
- `.next/static`
- `public/`
- `config/`
- `data/`
- `workflows/`
- `output/bootstrap.js`

## Required Env

- `MONGODB_URI`
- `MONGODB_DB`
- `API_CONFIG_ENCRYPTION_KEY`
- `CONSUL_HTTP_HOST` when `MONGODB_URI` uses an internal Byted discovery scheme and the runtime does not inject consul routing automatically

Optional but commonly used:

- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_API_BASE`
- `NEXT_DISABLE_IMAGE_OPTIMIZATION`
- `COMFYUI_API_URL`
- `CDN_BASE_URL`
- `CDN_DIR`
- `CDN_REGION`
- `CDN_EMAIL`

## Verification

- `https://<frontend-domain>/healthz`
- `https://<frontend-domain>/api/history?page=1&limit=1&lightweight=1&minimal=1`
- `https://<frontend-domain>/api/view-comfy?lightweight=true`

Helper script:

```bash
./skills/lemo-deploy/scripts/verify_deploy.sh \
  --frontend https://<frontend-domain> \
  --backend https://<frontend-domain>
```

## Common Failures

### `EADDRNOTAVAIL`

- Cause: runtime injected a non-bindable `HOSTNAME`
- Fix: start with `HOSTNAME=0.0.0.0` or use generated `bootstrap.js`

### Remote CDN Image 504

- Cause: Next image optimizer cannot reliably reach remote assets
- Fix: keep `NEXT_DISABLE_IMAGE_OPTIMIZATION=true`

### Relative Asset Fetch Fails

- Cause: server-side helpers cannot resolve `/upload/*` or `/outputs/*`
- Fix: set `NEXT_PUBLIC_BASE_URL=https://<frontend-domain>`

### Internal Mongo Discovery Fails

- Cause: `MONGODB_URI` uses an internal Byted discovery scheme such as `mongodb+consul+token://...` but the runtime lacks consul routing
- Fix: inject `CONSUL_HTTP_HOST` (and optionally `CONSUL_HTTP_PORT`) or provide `SERVICE_MESH_MONGO_ADDR`
