# Runtime Config Checklist (Upstream Direct)

This skill is hardcoded to call upstream services directly.

## 1) KV Optimization Required Config

- `LEMO_COZE_PROMPT_API_TOKEN` (recommended)
- or fallback `LEMO_COZE_API_TOKEN`
- optional `LEMO_COZE_PROMPT_RUN_URL`
  - default: `https://m5385m4ryw.coze.site/run`

Used by optimize binding: `coze-prompt`.

## 2) Seedream 4.5 Required Config

- `LEMO_COZE_SEED_API_TOKEN` (required)
- optional `LEMO_COZE_SEED_RUN_URL`
  - default: `https://2q3rqt6rnh.coze.site/run`

Used by generate binding: `coze_seedream4_5`.

## 3) Lemo Seed Required Config

Set all of these explicitly in production:

- `GATEWAY_BASE_URL`
- `BYTEDANCE_AID`
- `BYTEDANCE_APP_KEY`
- `BYTEDANCE_APP_SECRET`

Used by generate binding: `seed4_0407_lemo`.

## 4) Fixed Behavior Defaults

- default market: `US`
- default model route: `coze_seedream4_5`
- Lemo activation: only when user explicitly asks for Lemo
- first pass per-size output: `1`
- required output sizes:
  - `1125x600`
  - `1125x672`
  - `1054x720`
  - `1125x450`
  - `1080x1080`
  - `1080x1440`

## 5) How to Receive Image Results

Preferred (script-level):

- `node scripts/kv_generate.mjs ...`
  - stdout line 1: model + size
  - stdout line 2: primary image URL
- `node scripts/kv_pipeline.mjs ...`
  - six size result lines: `<WxH> | <method> | <imageUrl>`

Direct API integration (if bypassing scripts):

- normalize upstream response to `images[]`
- use `images[0]` as primary output
- keep per-size metadata:
  - `size`
  - `method` (`regenerated` or `fallback_adapted`)
  - `imageUrl`
