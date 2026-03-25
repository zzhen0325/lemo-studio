# Lemon8 AI Studio

## Quick Start

```bash
npm install
npm run dev
```

App runs on `3001` by default and serves both UI and `/api/*` from the same Next.js Node process.

## Build Scripts

```bash
./build.frontend.sh
```

## Playwright E2E

```bash
pnpm playwright:install
pnpm test:e2e
pnpm test:e2e:headed
```

By default Playwright starts the Next dev server on `http://localhost:3001`.
Set `PLAYWRIGHT_BASE_URL` if you want to point tests at an already running server.

## Project Docs

- Structure guideline: `docs/PROJECT_STRUCTURE.md`
- Product philosophy & technical plan: `docs/product-philosophy-and-technical-plan.md`
- Deployment notes: `docs/DEPLOYMENT.md`
- Environment variables: `docs/ENVIRONMENT.md`
- Notes: `docs/notes/`
- Tool docs: `docs/tools/`
