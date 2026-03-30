# Second Round Refactor Constraints

## Layering
- Route handlers call services only. They do not talk to Supabase models or table-shaped helpers directly.
- Services own business rules, auth scope, migration rules, and DTO shaping.
- Repositories own persistence concerns. Repository inputs and stored docs use `snake_case`. Service and client DTOs use `camelCase`.
- Cross-layer objects must not carry both `snake_case` and `camelCase` aliases for the same field.

## Server Boundaries
- `lib/server/repositories/` is the only allowed place for new persistence code.
- Do not reintroduce `ModelType`, `Injectable`, `Inject`, `connectMongo`, or pseudo-DI wiring.
- If a new service needs storage access, add a repository method instead of exposing generic `updateOne/deleteOne/findOneAndUpdate`.
- Actor ownership stays server-derived. Handlers and services must not trust client-supplied user ids for protected data.

## Playground Data Flow
- SWR owns server data such as history, gallery, presets, categories, and styles.
- Zustand is reserved for local editor/UI state: input config, dialogs, drag state, selection, and temporary in-flight edits.
- Optimistic history items may exist locally, but persisted history must reconcile through SWR mutate instead of dual writes into store mirrors.
- Heavy playground dialogs and editors must load through `next/dynamic`.

## AI Provider Boundaries
- Top-level `lib/ai/providers.ts` is a thin export surface only.
- Provider runtime config loading is lazy and isolated in `lib/ai/provider-config-loader.ts`.
- `modelRegistry` may resolve config and select providers, but must not perform import-time file IO or noisy runtime logging.
- New provider families belong under `lib/ai/providers/`.

## Infinite Canvas Boundaries
- Project CRUD lives under `app/infinite-canvas/_lib/project-api.ts`.
- Generation and image offload logic lives under `app/infinite-canvas/_lib/generation-api.ts`.
- Project persistence state must stay separate from viewport, selection, and dialog UI state.
- Frontend ownership fallbacks are forbidden; owner claim stays server-side.

## Size Guardrails
- Default file threshold remains 500 lines for the repo baseline.
- `PlaygroundPageContainer.tsx` and `InfiniteCanvasEditor.tsx` are temporary hotspots capped at 1200 lines.
- Provider entry files are capped at 600 lines.
- Repository files are capped at 400 lines.
- When a file exceeds its cap, split by responsibility before adding new behavior.
