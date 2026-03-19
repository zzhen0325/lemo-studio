# Storage & Workflow Governance

## 1) Storage and concurrency consistency

### History API
- Primary storage: Supabase (`generations` table)
- Fallback storage: `public/outputs/history.json` (with atomic tmp rename)
- Concurrency guard: in-process write queue in `/app/api/history/route.ts`

### Projects API
- Primary storage: Supabase (`project_snapshots` table)
- Fallback storage: `public/outputs/projects.json` (atomic write)
- Concurrency guard: in-process write queue in `/app/api/projects/route.ts`

## 2) Workflow and asset governance

### Workflow governance
- Script: `npm run check:workflows`
- Strict gate (errors only): `npm run check:workflows:strict`
- Auto-fix index/config drift: `npm run fix:workflows`
- Duplicate cleanup + index migration: `npm run dedup:workflows`

Checks include:
- missing `index.json`, `config.json`, `workflow.json`
- duplicate index item id/folder
- config `id/title` drift from index
- potential duplicate folder families by canonical name (warning)

### Asset governance
- Script: `npm run check:assets`
- Strict gate: `npm run check:assets:strict`
- Migrate allowlist assets to CDN and cleanup local files: `npm run migrate:assets:cdn`
- Config file: `config/asset-governance.json`
- Migration output:
  - `config/cdn-assets-manifest.json` (uploaded file mapping)
  - `config/external-asset-redirects.json` (Next.js redirect rules)

Config fields:
- `maxFileSizeMB`: oversize threshold
- `trackedScopes`: path prefixes to scan
- `allowOversize`: baseline allowlist for known large files
