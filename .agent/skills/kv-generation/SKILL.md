---
name: kv-generation
description: Orchestrate KV image generation from natural-language requests. Use when users ask to generate/create/make KV (e.g., 生成KV, 做KV, create KV, US/SEA/JP KV) or ask to modify an existing KV variant. Detect KV intent, route market (US/SEA/JP), run KV structured prompt optimization first, generate with Seedream 4.5, and apply model-assisted variant/section edits before regeneration when users provide change instructions.
---

# KV Generation

## Overview

Execute a deterministic KV workflow from short user commands.

Keep the default chain as:

1. Detect KV intent and market.
2. Enter KV structured template mode.
3. Optimize prompt in KV structured flow.
4. Generate with Seedream 4.5.
5. If the user requests changes, edit the active variant/section with model calls, then regenerate.

## Trigger Rules

Trigger this skill when user intent includes KV generation actions, such as:

- Chinese: `生成KV`、`做KV`、`出KV`、`做一张美区KV`
- English: `generate kv`, `create us kv`, `make jp kv`

Do not trigger this skill for pure analysis requests without generation intent, for example:

- `点评这个 KV`
- `解释这个 KV 为什么好`

## Market Routing

Route market by explicit cues in user text:

- `US`: 美区 / 美国 / 北美 / us
- `SEA`: 东南亚 / sea
- `JP`: 日区 / 日本 / jp

Fallback to `US` when market is absent.

Map market to KV shortcut:

- `US -> us-kv`
- `SEA -> sea-kv`
- `JP -> jp-kv`

## Execution Workflow

### 1. Enter KV Mode

- Activate the routed KV shortcut template.
- Set model to `coze_seedream4_5`.
- Preserve current session state but clear conflicting preset/workflow bindings.

### 2. Run KV Structured Optimization

- Build optimization input from the active KV shortcut fields.
- Append extra user constraints (if present) as an instruction block.
- Send request through KV structured optimization flow (`playground_kv_structured`).
- Accept structured variants only; reject empty or non-usable variant payloads.

### 3. Generate KV

- Use the active variant prompt preview as generation prompt.
- Keep optimization source metadata attached to generation context.
- Execute generation with Seedream 4.5.

### 4. Apply User Modifications

When user asks for changes after optimization:

- If change targets a specific section (`canvas`, `subject`, `background`, `layout`, `typography`), run section edit.
- Otherwise run variant edit.
- Update active variant with edit result.
- Regenerate using updated prompt preview.

## Interaction Contract

- Keep workflow automatic by default; do not ask for manual confirmation unless blocked by missing required fields.
- If required KV fields are still missing, surface a concise missing-fields message and stop generation.
- If optimization fails to return usable variants, ask user to retry optimization.
- Keep non-KV prompts on normal generation flow.

## Output Expectations

For each successful run, provide:

- Active market and shortcut used.
- Whether optimization succeeded and variants were created.
- Whether user edits were applied before generation.
- Final generation status.
