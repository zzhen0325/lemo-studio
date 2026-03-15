# ComfyUI Cloud API 速查

## 1. 基本信息
- Cloud API 为实验性（可能调整）。
- 使用 `X-API-Key` 头进行鉴权。
- Base URL 为 `https://cloud.comfy.org`。
- WebSocket 使用 `wss://cloud.comfy.org/ws?clientId=<uuid>&token=<api_key>`。

## 2. 提交工作流
- `POST /api/prompt`：提交 workflow（API format）。
- 请求体字段：`prompt`、`number`、`front`、`extra_data`、`partial_execution_targets`。
- 响应字段：`prompt_id`、`number`、`node_errors`。

## 3. 查询与查看结果
- `GET /api/history_v2/{prompt_id}`：获取执行历史（v2）。
- `GET /api/view?filename=...`：查看单个输出文件，返回 302 跳转到真实文件链接。
  - `filename` 必填；`subfolder` 与 `type` 可选但会被忽略。
  - `channel` 仅对 PNG 生效（`rgb` 或 `a`）。

## 4. 上传输入
- `POST /api/upload/image`：上传输入图片，返回文件位置信息。
