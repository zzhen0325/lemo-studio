# Lemon8 AI Studio Deployment Summary

## Use This Reference For

- updating the single-service Next deployment
- checking required env vars
- verifying a live BOE deployment after changes
- debugging runtime startup issues

## Deployment

- Build script: `./build.sh`
- Output dir: `output`
- Start: `HOSTNAME=0.0.0.0 NODE_ENV=production node bootstrap.js`
- Health: `/healthz`

Required env:

- `MONGODB_URI`
- `MONGODB_DB`
- `API_CONFIG_ENCRYPTION_KEY`

Default recommendation:

- keep browser requests on same-origin `/api`
- leave `NEXT_PUBLIC_API_BASE` empty unless a public API origin override is required
- keep `NEXT_DISABLE_IMAGE_OPTIMIZATION=true`

## Verification URLs

- Frontend health: `/healthz`
- API history: `/api/history?page=1&limit=1&lightweight=1&minimal=1`
- API workflows: `/api/view-comfy?lightweight=true`

## Common Failure Patterns

### `EADDRNOTAVAIL`

- Cause: runtime injected an IPv6 `HOSTNAME` that was not bindable
- Fix: rely on generated `bootstrap.js` or set `HOSTNAME=0.0.0.0`

### Relative Asset Fetch Failure

- Cause: route handlers cannot resolve relative public asset URLs from server-side flows
- Fix: set `NEXT_PUBLIC_BASE_URL` to the deployed site origin
