---
name: lemo-deploy
description: Update, deploy, and verify Lemon8 AI Studio frontend/backend services on the ByteDance Node/FaaS BOE stack. Use when changing build scripts, startup commands, health checks, deployment env vars, API proxy behavior, or when validating live frontend/backend endpoints after a release.
---

# Lemo Deploy

## Quick Start

1. Read `references/current-deploy.md` for the latest known-good config.
2. Decide whether the task is frontend deploy, backend deploy, or both.
3. Update the relevant script and `docs/DEPLOYMENT.md` together.
4. After deployment, run `scripts/verify_deploy.sh --frontend <url> --backend <url>`.

## Standard Workflow

### Frontend

1. Keep browser requests on same-origin `/api/*` by default.
2. Set `GULUX_API_BASE` to the backend `/api` base.
3. Use `./build.sh` to package `.next/standalone`, `.next/static`, `public/`, and `bootstrap.js` into `output/`.
4. Keep runtime startup on `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`.
5. Keep health checks on `/healthz`.

### Backend

1. Use `./scripts/build-server.sh`.
2. Keep startup on `cd server && PORT=$PORT NODE_ENV=production gulux start --config server/config`.
3. Keep required env vars aligned with `docs/ENVIRONMENT.md`.

## Troubleshooting Rules

- Treat frontend requests to `https://<frontend-domain>/api/*` as expected in proxy mode.
- Only configure backend CORS when the browser directly calls the backend domain.
- If runtime fails with `EADDRNOTAVAIL`, enforce `HOSTNAME=0.0.0.0`.
- If `/api/history` or similar fails with `ERR_CONTENT_DECODING_FAILED`, redeploy the frontend with the latest proxy fix in `app/api/[...path]/route.ts`.
- If backend endpoints return `ENOENT` for `public/*`, verify deployment contents before changing application code.

## Resources

- `references/current-deploy.md`
  - current deployment commands, env vars, and common failures
- `scripts/verify_deploy.sh`
  - checks frontend health, frontend proxy, and direct backend endpoints
