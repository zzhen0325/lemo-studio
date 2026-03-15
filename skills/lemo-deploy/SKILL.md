---
name: lemo-deploy
description: Update, deploy, and verify the single-service Lemon8 AI Studio Next.js deployment on the ByteDance Node/FaaS BOE stack. Use when changing build scripts, startup commands, health checks, deployment env vars, or when validating live endpoints after a release.
---

# Lemo Deploy

## Quick Start

1. Read `references/current-deploy.md` for the latest known-good config.
2. Treat the deployment unit as a single Next.js service.
3. Update the relevant script and `docs/DEPLOYMENT.md` together.
4. After deployment, run `scripts/verify_deploy.sh --frontend <url> --backend <url>`.

## Standard Workflow

1. Keep browser requests on same-origin `/api/*` by default.
2. Use `./build.sh` to package `.next/standalone`, `.next/static`, `public/`, and `bootstrap.js` into `output/`.
3. Keep runtime startup on `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`.
4. Keep health checks on `/healthz`.
5. Keep required env vars aligned with `docs/ENVIRONMENT.md`.

## Troubleshooting Rules

- Treat frontend requests to `https://<frontend-domain>/api/*` as the normal production path.
- If runtime fails with `EADDRNOTAVAIL`, enforce `HOSTNAME=0.0.0.0`.
- If backend endpoints return `ENOENT` for `public/*`, verify deployment contents before changing application code.

## Resources

- `references/current-deploy.md`
  - current deployment commands, env vars, and common failures
- `scripts/verify_deploy.sh`
  - checks the deployed service health and API endpoints
