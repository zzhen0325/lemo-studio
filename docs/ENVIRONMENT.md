# Environment Variables

## Public / Next Runtime

- `NEXT_PUBLIC_API_BASE`
  - Optional public API origin override.
  - Leave empty to keep browser requests on same-origin `/api`.
- `NEXT_PUBLIC_APP_PORT`
  - Optional local dev port hint.
- `NEXT_PUBLIC_SIDEBAR_MODE`
  - Optional shell mode override.
- `NEXT_PUBLIC_COMFYUI_URL`
  - Optional UI preset for ComfyUI endpoint.
- `NEXT_PUBLIC_BASE_URL`
  - Optional absolute site origin used when server-side helpers need to resolve relative asset URLs.
- `NEXT_DISABLE_IMAGE_OPTIMIZATION`
  - Optional toggle for the Next image optimizer.
- `NEXT_IMAGE_ALLOWED_HOSTS`
  - Optional comma-separated allowlist for remote image hosts.
- `NEXT_PUBLIC_ENABLE_TWEAKCN_LIVE_PREVIEW`
  - Optional tweakcn preview flag.

## Server Required

- `API_CONFIG_ENCRYPTION_KEY`
  - Secret used to encrypt stored provider API keys.
- Supabase database is auto-configured via COZE integration.

## AI Providers

- `DOUBAO_API_KEY`
- `DOUBAO_BASE_URL`
- `DOUBAO_MODEL`
- `GOOGLE_API_KEY`
- `GOOGLE_GENAI_API_KEY`
- `GOOGLE_TRANSLATE_API_KEY`
- `DEEPSEEK_API_KEY`
- `COZE_API_TOKEN`
- `COZE_PROMPT_API_TOKEN`
- `COZE_PROMPT_RUN_URL`
- `COZE_SEED_API_TOKEN`
- `COZE_SEED_RUN_URL`
- `GATEWAY_BASE_URL`
- `BYTEDANCE_AID`
- `BYTEDANCE_APP_KEY`
- `BYTEDANCE_APP_SECRET`

## ComfyUI / ViewComfy

- `COMFYUI_API_URL`
- `COMFYUI_SECURE`
- `VIEW_COMFY_FILE_NAME`
- `VIEWCOMFY_CLOUD_API_URL`
- `VIEWCOMFY_CLIENT_ID`
- `VIEWCOMFY_CLIENT_SECRET`
- `NEXT_PUBLIC_VIEWCOMFY_CLIENT_ID`
- `NEXT_PUBLIC_VIEWCOMFY_CLIENT_SECRET`

## Storage / CDN

- `DATASET_DIR`
- `CLOUD_STORAGE`
- `CLOUD_PUBLIC_BASE`
- `CDN_BASE_URL`
- `CDN_DIR`
- `CDN_REGION`
- `CDN_EMAIL`
- `RUNTIME_CDN_DIR`

## Rules

- Client code should default to same-origin `/api/*`.
- Do not depend on `GULUX_API_BASE` or `INTERNAL_API_BASE`; those paths are retired.
- For local development, prefer `npm run dev` over editing `.env.local`.
