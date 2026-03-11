# Environment Variables

## Frontend (Next.js)

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
  - In production, this must be present at frontend build time or injected via the runtime HTML environment script.
- `NEXT_PUBLIC_COMFYUI_URL`
  - Optional UI preset value for ComfyUI endpoint in Settings.
  - Do not set this on HTTPS production pages unless ComfyUI is also exposed through HTTPS/WSS. An HTTPS page cannot directly call an HTTP ComfyUI origin from the browser.
- `NEXT_PUBLIC_APP_PORT`
  - Optional SSR fallback port when runtime cannot read browser port.
- `NEXT_PUBLIC_SIDEBAR_MODE`
  - Optional shell mode override.
  - `playground-only`: only show Playground entry.
  - `full`: show full sidebar.
- `NEXT_IMAGE_ALLOWED_HOSTS`
  - Optional comma-separated allowlist for remote image domains used by `next/image`.
  - Only needed when image URLs come from hosts outside the built-in defaults.
- `NEXT_DISABLE_IMAGE_OPTIMIZATION`
  - Optional boolean toggle for the Next.js `/_next/image` optimizer.
  - Default: `true`, so remote CDN images load directly in the browser instead of being fetched server-side.
  - Set to `false` only in environments where the frontend server can reliably reach all remote image hosts without `504 Gateway Timeout` errors.
  - Recommended production value for BOE/CDN split deployment: `true`.
- `NEXT_PUBLIC_ENABLE_TWEAKCN_LIVE_PREVIEW`
  - Optional feature flag for the tweakcn live preview shell.
  - Set to `true` only when that preview flow is needed.
- `NEXT_PUBLIC_BASE_URL`
  - Optional absolute site origin used by backend-side image fetching helpers in split deployments.
  - Example: `https://your-frontend.example.com`.
  - Recommended production value whenever image edit/reference flows may submit relative paths such as `/upload/*` or `/outputs/*`.

## Backend Required (Gulux server)

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

## AI Providers (Backend Only)

- `DOUBAO_API_KEY`
  - Primary API key for Doubao generation and translation flows.
- `DOUBAO_BASE_URL`
  - Optional override for the Doubao/OpenAI-compatible base URL.
  - Default: `https://ark.cn-beijing.volces.com/api/v3`.
- `DOUBAO_MODEL`
  - Optional default Doubao model override used by the registry.
- `GOOGLE_API_KEY`
  - Optional Google provider key fallback.
- `GOOGLE_GENAI_API_KEY`
  - Optional preferred Google GenAI key for Gemini models.
- `GOOGLE_TRANSLATE_API_KEY`
  - Optional dedicated key for Google Translate.
  - If unset, translation falls back to `GOOGLE_API_KEY` / `GOOGLE_GENAI_API_KEY`.
- `DEEPSEEK_API_KEY`
  - Optional DeepSeek API key.
- `COZE_API_TOKEN`
  - Optional Coze chat/image token used by non-workflow Coze providers.
- `COZE_PROMPT_API_TOKEN`
  - Optional dedicated token for the Coze prompt workflow.
- `COZE_PROMPT_RUN_URL`
  - Optional override for the Coze prompt workflow endpoint.
- `COZE_SEED_API_TOKEN`
  - Optional dedicated token for the Seedream 4.5 Coze workflow.
- `COZE_SEED_RUN_URL`
  - Optional override for the Seedream 4.5 workflow endpoint.
- `GATEWAY_BASE_URL`
  - Optional base URL override for the ByteDance AFR image generation gateway.
- `BYTEDANCE_AID`
  - Optional ByteDance AFR application ID.
- `BYTEDANCE_APP_KEY`
  - Optional ByteDance AFR application key.
  - Required in production for `seed4_v2_0226lemo` and related AFR-backed models.
- `BYTEDANCE_APP_SECRET`
  - Optional ByteDance AFR application secret.
  - Required in production for `seed4_v2_0226lemo` and related AFR-backed models.

## ComfyUI / ViewComfy

- `COMFYUI_API_URL`
  - Optional backend-side ComfyUI endpoint.
- `COMFYUI_SECURE`
  - Optional boolean flag for HTTPS/WSS ComfyUI connections.
- `VIEW_COMFY_FILE_NAME`
  - Optional workflow index file name.
  - Default: `workflows/index.json`.
- `VIEWCOMFY_CLOUD_API_URL`
  - Optional backend-side ViewComfy cloud API endpoint.
- `VIEWCOMFY_CLIENT_ID`
  - Optional backend-side ViewComfy client ID.
- `VIEWCOMFY_CLIENT_SECRET`
  - Optional backend-side ViewComfy client secret.
- `NEXT_PUBLIC_VIEWCOMFY_CLIENT_ID`
  - Optional public ViewComfy web-client ID.
- `NEXT_PUBLIC_VIEWCOMFY_CLIENT_SECRET`
  - Optional public ViewComfy web-client secret used by the frontend integration.

## Storage / CDN

- `DATASET_DIR`
  - Optional local dataset storage root.
  - Default: `public/dataset` under the workspace root.
- `CLOUD_STORAGE`
  - Optional storage mode switch.
  - Current supported value in-app is effectively `local`; `tos` / `s3` remain placeholders.
- `CLOUD_PUBLIC_BASE`
  - Optional absolute public base URL used to build dataset asset URLs.
- `CDN_BASE_URL`
  - Optional CDN upload host override.
- `CDN_DIR`
  - Optional default CDN directory for uploaded assets.
- `CDN_REGION`
  - Optional CDN region.
  - Default: `SG`.
- `CDN_EMAIL`
  - Optional uploader email for CDN uploads.
  - Required when runtime asset upload paths are exercised.
- `RUNTIME_CDN_DIR`
  - Optional separate CDN directory for runtime-generated assets.

## API Access Rule

- Browser calls must use same-origin `/api/*`.
- Do not hardcode cross-port backend URLs in frontend code.
- For local debug, prefer `npm run dev` or `npm run dev:proxy:boe` over editing `.env.local`.

## Intentionally Omitted From `.env.example`

- Runtime-injected variables such as `PORT`, `HOST`, and `HOSTNAME`.
- Advanced fallback variables such as `INTERNAL_API_BASE`.
- Debug-only flags such as `NEXT_PUBLIC_HISTORY_DEBUG`, `DEBUG_HISTORY`, and `HISTORY_DEBUG`.
- One-off script/test knobs that are not part of the normal app deployment contract.
