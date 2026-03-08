# Environment Variables

## Frontend (Next.js)

- `PORT`
  - Frontend runtime port.
  - Usually injected by the deployment platform; no need to hardcode locally.
- `GULUX_API_BASE`
  - Server-side backend target for the Next route-handler proxy at `/api/:path*`.
  - Required for split frontend/backend deployment.
  - Default local value: `http://127.0.0.1:3000/api`.
  - Recommended production value: `https://qzcnzen0.fn-boe.bytedance.net/api`.
- `NEXT_PUBLIC_API_BASE`
  - Optional browser-side direct API base.
  - If omitted or empty, browser requests use same-origin `/api`.
  - Recommended local dev value: leave empty and use the Next proxy.
  - Recommended production value: `https://qzcnzen0.fn-boe.bytedance.net/api`.
  - The runtime now auto-appends `/api` when you only provide the backend origin, but the full `/api` form is still recommended.
- `NEXT_PUBLIC_COMFYUI_URL`
  - Optional UI preset value for ComfyUI endpoint in Settings.
- `NEXT_PUBLIC_APP_PORT`
  - Optional SSR fallback port when runtime cannot read browser port.
- `NEXT_PUBLIC_SIDEBAR_MODE`
  - Optional shell mode override.
  - `playground-only`: only show Playground entry.
  - `full`: show full sidebar.
- `NEXT_IMAGE_ALLOWED_HOSTS`
  - Optional comma-separated allowlist for remote image domains used by `next/image`.
  - Only needed when image URLs come from hosts outside the built-in defaults.

## Backend (Gulux server)

- `MONGODB_URI`
  - Mongo connection URI.
  - Required in production deployment. The server only falls back to a local dev URI outside production.
- `MONGODB_DB`
  - Mongo database name.
  - Set this explicitly when your URI does not include a database name.
- `API_CONFIG_ENCRYPTION_KEY`
  - Secret key for encrypting stored provider `apiKey`.
  - Should be a high-entropy secret managed outside source control.
- `CORS_ALLOW_ORIGINS`
  - Required when `NEXT_PUBLIC_API_BASE` points browser requests to a different origin.
  - Use a comma-separated list of allowed frontend origins, for example `https://your-frontend.example.com`.

## API Access Rule

- Browser calls must use same-origin `/api/*`.
- Do not hardcode cross-port backend URLs in frontend code.
- For local debug, prefer `npm run dev` or `npm run dev:proxy:boe` over editing `.env.local`.
