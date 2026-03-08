# Lemon8 AI Studio

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs on `3001` by default and uses same-origin `/api` to proxy to the local backend.

## Backend (Gulux)

```bash
npm run dev:server
```

## Local Debug Switching

Use the frontend mode scripts instead of hand-editing `.env.local`:

```bash
# Default: frontend -> /api -> local backend http://127.0.0.1:3000/api
npm run dev

# Frontend still calls /api, but proxy to BOE backend
npm run dev:proxy:boe

# Browser directly calls local backend (only when you really need direct mode)
npm run dev:direct:local
```

For custom targets:

```bash
GULUX_API_BASE=https://your-backend.example.com/api npm run dev:proxy:custom
NEXT_PUBLIC_API_BASE=https://your-backend.example.com/api npm run dev:direct:custom
```

## Split Build Scripts

```bash
./build.frontend.sh
./build.backend.sh
```

## Project Docs

- Structure guideline: `docs/PROJECT_STRUCTURE.md`
- Deployment notes: `docs/DEPLOYMENT.md`
- Environment variables: `docs/ENVIRONMENT.md`
- Notes: `docs/notes/`
- Tool docs: `docs/tools/`
