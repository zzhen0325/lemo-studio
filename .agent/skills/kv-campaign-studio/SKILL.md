---
name: kv-campaign-studio
description: End-to-end KV campaign generation orchestrator for activity KV and official-account posters. Use when users ask to create or iterate a themed campaign KV/官号 visual; auto-complete KV fields, run structured optimization, generate with Seedream by default, optionally use Lemo when explicitly requested, and deliver six required sizes with regenerate-first then fallback resize.
---

# KV Campaign Studio

## Overview

Run a deterministic workflow for campaign KV generation and iterative refinement.

Default behavior:

1. Parse user intent and detect market.
2. Auto-complete KV core fields.
3. Run KV structured prompt optimization.
4. Generate master candidate with Seedream.
5. Produce six target sizes through a mixed pipeline (regenerate first, fallback to master adaptation).
6. Return editable session output for follow-up refinements.

## Trigger Rules

Trigger this skill when intent is direct KV creation/refinement, such as:

- Chinese: `帮我做一个XX主题活动KV`、`做一个官号KV`、`做春季活动主视觉`、`把这个KV再精修`
- English: `create a campaign kv`, `make an official-account kv`, `refine this kv`

Do not trigger this skill for pure critique/explanation requests with no generation intent.

## Project-Pinned Execution (Hardcoded)

Use fixed upstream integrations already connected by this project. Do not call local `/api/*`.

- KV optimization upstream: Coze Prompt Run URL (default `https://m5385m4ryw.coze.site/run`)
- KV optimization model binding: `coze-prompt`
- Seedream upstream: Coze Seed Run URL (default `https://2q3rqt6rnh.coze.site/run`)
- Seedream model binding: `coze_seedream4_5`
- Lemo upstream: AFR submit/poll APIs under `GATEWAY_BASE_URL`
- Lemo model binding: `seed4_0407_lemo`

No provider routing customization is required in this skill version.

## Input Contract

### Required user input

- Natural-language campaign intent.

### Auto-completed fields

When user input is underspecified, auto-complete and expose editable defaults for:

- `mainTitle`
- `subTitle`
- `eventTime`
- `heroSubject`
- `style`
- `primaryColor`

### Optional user overrides

- `market` (`US` / `SEA` / `JP`)
- `modelPreference` (`seedream` / `lemo`)
- `brandConstraints`
- `safetyConstraints`

## Routing Rules

### Market routing

Detect market by text cues, with user override taking priority:

- `US`: 美区 / 美国 / 北美 / us
- `SEA`: 东南亚 / sea
- `JP`: 日区 / 日本 / jp

Default to `US` if absent.

### Model routing

- Default primary model: `coze_seedream4_5`.
- Enable `seed4_0407_lemo` only when user explicitly mentions Lemo-related cues.
- If Lemo cannot satisfy size constraints, do not fail the run; use fallback adaptation path.

## Generation Workflow

### 1. Build editable KV draft

- Extract available details from user text.
- Auto-complete missing core fields.
- Keep the draft editable for downstream refinements.

### 2. Structured optimization

- Build optimization input from KV fields.
- Prefix input with `[Event kv]`.
- Call Coze Prompt Run URL using model binding `coze-prompt`.
- Use system prompt in `references/kv-optimization-system-prompt.md`.
- Parse optimizer response into internal structured sections.

### 3. Master candidate generation

- Generate a master candidate with `coze_seedream4_5` via Coze Seed Run URL.
- Use optimized prompt as source.
- Preserve master asset for fallback size recovery.

### 4. Mixed size pipeline

Target sizes (all required):

- `1125x600`
- `1125x672`
- `1054x720`
- `1125x450`
- `1080x1080`
- `1080x1440`

For each size:

1. Try direct regenerate with optimized prompt and target dimensions.
2. If regenerate fails or violates model constraints, adapt from master candidate (crop/resize/pad based on safety policy).
3. Mark the size result with method metadata (`regenerated` or `fallback_adapted`).

Default first-pass yield: `1 image per size`.

## Refinement Loop

When user provides update instructions:

1. Apply minimal edits to current structured variant or selected section.
2. Re-run generation for requested sizes only (or all sizes if unspecified).
3. Keep history linked to current session for continuous tuning.

## Output Contract (Natural Language)

Always respond in natural language. Do not return raw JSON to end users.

For each successful run, include:

- One short summary line: resolved market + model routing + run status.
- One editable field recap: mainTitle / subTitle / eventTime / heroSubject / style / primaryColor.
- Size results list (6 lines): each line contains `size`, `method`, and `imageUrl`.
- One follow-up hint: how user can continue refinement in one sentence.

## Failure Handling

- Do not fail the entire run for single-size errors.
- If a size cannot be regenerated, fallback to master adaptation.
- If both paths fail for a size, report it explicitly and continue returning other sizes.
- If optimization payload is unusable, ask for a retry with concise cause.

## Scripts

Use bundled executable scripts for upstream direct calls:

- `scripts/kv_optimize.mjs`
  - Example: `node scripts/kv_optimize.mjs --input "帮我做一个春季活动KV官号"`
- `scripts/kv_generate.mjs`
  - Example: `node scripts/kv_generate.mjs --prompt "<optimized prompt>" --model coze_seedream4_5 --width 1125 --height 600`
- `scripts/kv_pipeline.mjs`
  - Example: `node scripts/kv_pipeline.mjs --intent "帮我做一个春季活动KV官号"`

If your platform cannot invoke skills directly, run these scripts as the execution layer and keep this `SKILL.md` as orchestration spec.

## References

Load only when needed:

- Project fixed call chain: `references/project-fixed-calls.md`
- Runtime config checklist: `references/runtime-config-checklist.md`
- Adapter interfaces: `references/adapter-contract.md`
- KV optimization system prompt: `references/kv-optimization-system-prompt.md`
- Size pipeline details: `references/size-pipeline.md`
- Prompt and field policy: `references/prompt-policy.md`
