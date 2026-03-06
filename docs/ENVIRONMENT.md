# Environment Variables

## Frontend (Next.js)

- `GULUX_API_BASE`
  - Internal backend target for the Next route-handler proxy at `/api/:path*`.
  - Default: `http://127.0.0.1:3000/api`.
- `NEXT_PUBLIC_COMFYUI_URL`
  - Optional UI preset value for ComfyUI endpoint in Settings.
- `NEXT_PUBLIC_APP_PORT`
  - Optional SSR fallback port when runtime cannot read browser port.
- `NEXT_PUBLIC_SIDEBAR_MODE`
  - Optional shell mode override.
  - `playground-only`: only show Playground entry.
  - `full`: show full sidebar.

## Backend (Gulux server)

- `MONGODB_URI`
  - Mongo connection URI.
- `MONGODB_DB`
  - Mongo database name.
- `API_CONFIG_ENCRYPTION_KEY`
  - Secret key for encrypting stored provider `apiKey`.
  - Should be a high-entropy secret managed outside source control.

## API Access Rule

- Browser calls must use same-origin `/api/*`.
- Do not hardcode cross-port backend URLs in frontend code.
