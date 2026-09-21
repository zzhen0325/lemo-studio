# Deployment Notes

## Runtime Model

- Deploy a single Next.js Node service.
- UI pages and `/api/*` route handlers run inside the same process.
- Supabase (via COZE integration), Object Storage (via COZE integration), ComfyUI, ViewComfy, and AI providers remain external dependencies configured by env vars.

## Build And Start

The authoritative platform commands are in `.coze`:

- Build: `./scripts/deploy-build.sh` (installs dependencies, runs `pnpm build`, copies `public/` and the startup script).
- Output: `.next/standalone`.
- Start: `sh .next/standalone/start.sh`.
- Health check: `/healthz`.
- Startup binds `HOSTNAME=0.0.0.0` and uses `DEPLOY_RUN_PORT`, then `PORT`, then `5000`.

Local development uses `pnpm dev:local`; see [local development](features/local-development.md). Leave `STUDIO_RUNTIME` unset on Coze to retain platform database and object storage.

## Required Env

- `API_CONFIG_ENCRYPTION_KEY`
- Supabase database is auto-configured via COZE integration

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
- Fix: start with `HOSTNAME=0.0.0.0` or use `scripts/start-standalone.sh`

### Remote CDN Image 504

- Cause: Next image optimizer cannot reliably reach remote assets
- Fix: keep `NEXT_DISABLE_IMAGE_OPTIMIZATION=true`

### Relative Asset Fetch Fails

- Cause: server-side helpers cannot resolve `/upload/*` or `/outputs/*`
- Fix: set `NEXT_PUBLIC_BASE_URL=https://<frontend-domain>`
