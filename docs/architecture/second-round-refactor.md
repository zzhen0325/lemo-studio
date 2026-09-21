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
- Each provider family contains its implementation, rather than forwarding to a shared legacy implementation. Coze image input normalization, output parsing, and provider diagnostics have separate modules.
- `providers.ts` and `providers/index.ts` retain the public exports. `coze-image.ts` also retains its `CozeWorkflowImageProvider` export for existing callers.
- Provider size checks cover both direct children and nested files; no legacy implementation is exempted.

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

## Cleanup Status (2026-09-21)

Completed: removed the 2,006-line `lib/ai/providers/legacy.ts`, moved all seven provider classes into their family modules, and separated shared Coze image helpers. Request construction, response parsing, fallback behavior, and public class names remain unchanged. The largest resulting provider module is 398 lines.

Second batch: extracted `usePlaygroundUploads` (170 lines) and `usePlaygroundHistoryActions` (244 lines) from the Playground container. The container decreased from 3,873 to 3,530 lines. Upload finalization still uses the existing store actions; history actions receive generation and SWR refresh callbacks without introducing another data cache. Seven regression tests cover history reuse and upload completion/failure. The container remains above its cap; structured prompt editing and optimization orchestration still need separate extraction.

Remaining priorities from the source audit:

| Area | Observed state | Next boundary to establish |
| --- | --- | --- |
| Playground orchestration | `PlaygroundPageContainer.tsx`: 3,530 lines after the second batch, above the 1,200-line temporary cap | Separate generation orchestration, editor state, and dialog composition; verify history reconciliation through SWR |
| Infinite Canvas orchestration | `InfiniteCanvasEditor.tsx`: 2,507 lines, above the 1,200-line temporary cap | Separate project persistence from viewport, selection, and dialog state |
| Persistence adapter | `lib/server/db/models.ts`: 1,603 lines; repositories still depend on its Mongoose-like query interface over Supabase | Migrate one repository at a time to explicit storage operations, preserving filtering, ownership, and DTO behavior |
| Stored key compatibility | Dataset and Canvas services still call `utils/mongo.ts` | Establish existing stored key formats and migration requirements before removing compatibility conversion |

These are active dependencies, not confirmed dead code. File age or a legacy name alone is insufficient evidence for deletion. The line counts above are an audit snapshot, not additional exceptions to the size guardrails.
