# Project Fixed Calls (Pinned to This Repo)

Use this exact upstream call chain in this repository. Do not use local `/api/*`.

## 1) KV Prompt Optimization (fixed)

### Endpoint

- `POST ${LEMO_COZE_PROMPT_RUN_URL}`
- default: `https://m5385m4ryw.coze.site/run`

### Auth

- `Authorization: Bearer ${LEMO_COZE_PROMPT_API_TOKEN}`
- fallback token env: `LEMO_COZE_API_TOKEN`

### Input build

1. Build KV template input from shortcut fields.
2. Prefix input with KV tag:
   - `"[Event kv]\n" + optimizationInput`
3. Load system prompt from:
   - `references/kv-optimization-system-prompt.md`
4. Send body as:

```json
{
  "text": "<systemPrompt + '\\n\\n' + taggedInput>"
}
```

### Response acceptance

- Parse text-like field from nested payload (`text/output/result/content/...`).
- Optimizer output is natural language sections.

## 2) Seedream 4.5 Generation (fixed)

### Endpoint

- `POST ${LEMO_COZE_SEED_RUN_URL}`
- default: `https://2q3rqt6rnh.coze.site/run`

### Auth

- `Authorization: Bearer ${LEMO_COZE_SEED_API_TOKEN}`

### Request body

```json
{
  "prompt": "<optimized prompt>",
  "reference_images": [],
  "size": "1125x600",
  "watermark": false
}
```

### Response acceptance

- Recursively extract image candidates from nested payload.
- Accept:
  - direct image URL
  - `data:image/...` URL
  - plain base64 (converted to `data:image/png;base64,...`)

## 3) Lemo Seed Generation (fixed)

### Endpoints

- Submit: `POST ${GATEWAY_BASE_URL}/media/api/pic/submit_task_v2`
- Poll: `POST ${GATEWAY_BASE_URL}/media/api/pic/batch_get_result_v2`

### Auth/signing

- Form fields: `aid/app_key/nonce/timestamp/sign`
- `sign = SHA1(sort([nonce, timestamp, app_secret]).join(""))`

### Request core params

- `req_key=seed4_0407_lemo`
- `req_json={"width":W,"height":H,"seed":-1,"Prompt":"..."}`
- `img_return_type=url`
- `img_return_format=png`

### Constraints from repo config

- `seed4_0407_lemo` has low-side constraints (`minWidth=1024`, `minHeight=1024`).
- For sizes below constraint, route to fallback adaptation from master image.

## 4) How to Receive Returned Images

Use the script outputs as final acceptance format:

- `kv_generate.mjs` stdout:
  - line 1: `<model> <size>`
  - line 2: `<primaryImageUrl>`
- `kv_pipeline.mjs` stdout:
  - summary line
  - field recap line
  - six size lines: `<WxH> | <method> | <imageUrl>`
  - next-action line

If you consume upstream responses directly, normalize into:

- `images[0]` as primary output URL
- per-size tuple:
  - `width`
  - `height`
  - `imageUrl`
  - `method` (`regenerated` or `fallback_adapted`)
