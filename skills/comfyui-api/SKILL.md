---
name: comfyui-api
description: ComfyUI 本地 Server 与 ComfyUI Cloud 的 API 调用与 workflow 执行指南。用于：通过 HTTP/WebSocket 提交 workflow、跟踪执行进度、获取输出文件、调试节点与错误、以及将 UI workflow JSON 转为 API format。
---

# ComfyUI API

## 概览
提供从“准备 workflow → 提交执行 → 监听进度 → 拉取结果 → 排错”的完整流程，并覆盖本地 Server 与 Cloud 两种目标环境。

## 工作流决策树
1. 判断目标环境：本地 Server 或 Cloud。
2. 准备 workflow：优先导出 **API format**（UI 中 Save API Format）。
3. 提交 workflow：本地用 `/prompt`；Cloud 用 `/api/prompt`。
4. 监听执行：连接 `/ws`，根据消息类型展示进度或错误。
5. 拉取输出：用 `/history`（或 Cloud 的 `history_v2`）拿到输出，再用 `/view` 拉文件。

## 执行步骤
### 1) 选择环境与鉴权
- 本地 Server：无需 API Key。
- Cloud：使用 `X-API-Key` 头。
- 细节见 `references/cloud-api.md`。

### 2) 准备 workflow
- 使用 API format（节点 ID → `class_type` + `inputs`）。
- 若只有 UI workflow JSON，先转换为 API format。
- 细节见 `references/workflow-json.md`。

### 3) 提交与监听
- 本地 Server 走 `/prompt` + `/ws`。
- Cloud 走 `/api/prompt` + `wss://cloud.comfy.org/ws`。
- 细节见 `references/server-api.md` 与 `references/cloud-api.md`。

### 4) 拉取输出
- 先取历史记录，拿到输出文件信息。
- 再用 `/view` 拉取文件。
- 细节见 `references/examples.md`。

## 调试与排错
- 使用 `/object_info` 获取节点字段定义。
- 提交失败时读取 `node_errors`，逐节点修正。
- 若路由参数不明确，按官方建议在 `server.py` 中搜索 `@routes`。

## 脚本
- `scripts/comfyui_client.py`：Python 端到端调用脚本（提交、轮询、下载）。
  - 用法：
    - `python3 scripts/comfyui_client.py --mode local --base-url http://127.0.0.1:8188 --workflow ./api_workflow.json --outdir ./outputs`
    - `python3 scripts/comfyui_client.py --mode cloud --api-key $COMFY_API_KEY --workflow ./api_workflow.json --outdir ./outputs`
- `scripts/comfyui_client.mjs`：Node 端到端调用脚本（提交、轮询、下载）。
  - 用法：
    - `node scripts/comfyui_client.mjs --mode local --base-url http://127.0.0.1:8188 --workflow ./api_workflow.json --outdir ./outputs`
    - `node scripts/comfyui_client.mjs --mode cloud --api-key $COMFY_API_KEY --workflow ./api_workflow.json --outdir ./outputs`

## 资源索引
- `scripts/comfyui_client.py`：Python 端到端调用脚本
- `scripts/comfyui_client.mjs`：Node 端到端调用脚本
- `references/server-api.md`：本地 Server API 路由与 WS 消息
- `references/cloud-api.md`：Cloud API 鉴权、提交、结果与上传
- `references/workflow-json.md`：workflow JSON 与 API format 区分
- `references/examples.md`：最小可行流程示例（curl）
