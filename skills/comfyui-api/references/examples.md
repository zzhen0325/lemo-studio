# API 调用示例（最小可行流程）

> 说明：示例以“API format 的 workflow”为输入。对于本地 Server，请按官方建议在 `server.py` 中核对 `@routes` 的实际参数字段。

## A. 本地 ComfyUI Server（HTTP + WebSocket）

### 1) 提交 workflow
```bash
curl -sS -X POST "${COMFY_BASE}/prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt": <API_WORKFLOW_JSON>}'
```

期望返回：`prompt_id` 与队列 `number`；失败时返回 `error` 与 `node_errors`。

### 2) 监听执行进度
```text
ws://${COMFY_HOST}/ws
```
监听消息类型：`execution_start` / `executing` / `progress` / `executed` / `execution_success` 等。

### 3) 拉取结果
```bash
curl -sS "${COMFY_BASE}/history/${PROMPT_ID}"
```
从历史记录里的输出信息中拿到 `filename/subfolder/type` 后，再用 `/view` 拉取文件。

## B. ComfyUI Cloud（HTTP + WebSocket）

### 1) 提交 workflow
```bash
curl -sS -X POST "https://cloud.comfy.org/api/prompt" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COMFY_API_KEY}" \
  -d '{"prompt": <API_WORKFLOW_JSON>, "number": 1}'
```

### 2) 监听执行进度
```text
wss://cloud.comfy.org/ws?clientId=<uuid>&token=<api_key>
```

### 3) 拉取结果
```bash
curl -sS "https://cloud.comfy.org/api/history_v2/${PROMPT_ID}" \
  -H "X-API-Key: ${COMFY_API_KEY}"

curl -i "https://cloud.comfy.org/api/view?filename=<FILE>" \
  -H "X-API-Key: ${COMFY_API_KEY}"
```

> Cloud 的 `/api/view` 返回 302 跳转，真实文件链接在响应头中。
