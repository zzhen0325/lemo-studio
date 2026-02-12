# Project Structure Guide

## Root Directory Rules

Only keep project-level config and entry files in root:

- `package.json`, lock files, ts/js config
- framework config (`next.config.mjs`, `tailwind.config.ts`, etc.)
- required workflow fallback files (`Flux_klein_I2I.json`, `Flux_klein_T2I.json`, `view_comfy.json`)

Do not place temporary scripts, test drafts, or generated screenshots in root.

## Recommended Folder Usage

- `app/`: Next.js App Router pages and API routes
- `pages/`: legacy/compatible page routes still in use
- `components/`: reusable UI and feature components
- `lib/`: shared business logic, API adapters, stores
- `server/`: Gulux backend source
- `scripts/`: maintenance scripts and one-off migration tools
- `docs/`: product/engineering docs
- `tests/`: test cases
- `workflows/`: workflow templates and configs

## Generated Artifacts

Do not commit generated build artifacts:

- `server/output/` (Gulux build output)
- `.next/` (Next.js build output)
- runtime logs and temporary output files

## Cleanup Checklist (Before Commit)

1. Ensure no temporary files were added in root.
2. Ensure build artifacts are not committed.
3. Move implementation notes to `docs/` (for example `docs/notes/`).
4. Keep tool-specific docs under `docs/tools/`.
