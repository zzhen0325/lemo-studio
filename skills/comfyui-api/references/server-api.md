# ComfyUI 本地 Server API 速查

## 1. 关键路由
以下为官方文档列出的内置路由（以本地 ComfyUI Server 为目标）。

- `/prompt` (GET/POST)：获取队列/执行信息；提交工作流到队列
- `/queue` (GET/POST)：查看队列；清空/管理队列
- `/history` (GET/POST) 与 `/history/{prompt_id}` (GET)：历史记录与单次执行结果
- `/ws` (WebSocket)：实时状态与执行进度
- `/view` (GET)：查看输出文件（参数较多，详见 `server.py` 的 `/view` 路由）
- `/upload/image`、`/upload/mask` (POST)：上传输入图片/蒙版
- `/object_info` 与 `/object_info/{node_class}` (GET)：节点定义
- `/system_stats` (GET)：系统信息
- 还有 `/interrupt`、`/free`、`/userdata`、`/users` 等路由

## 2. 提交工作流与返回结果
- Web 客户端提交工作流会 `POST /prompt`，服务端会校验并加入执行队列。
- 成功时返回 `prompt_id` 与 `number`（队列位置）；失败时返回 `error` 与 `node_errors`。

> 注意：本地 API 的完整请求体字段在不同版本可能有差异。官方建议在 `server.py` 中搜索 `@routes` 以确认实现细节。

## 3. WebSocket 消息类型
`/ws` 用于实时更新（队列状态、执行进度、错误信息等）。官方文档列出的内置消息类型与字段如下：

- `execution_start`: `prompt_id`
- `execution_error`: `prompt_id` + 其他错误信息
- `execution_interrupted`: `prompt_id`, `node_id`, `node_type`, `executed`
- `execution_cached`: `prompt_id`, `nodes`
- `execution_success`: `prompt_id`, `timestamp`
- `executing`: `node`, `prompt_id`
- `executed`: `node`, `prompt_id`, `output`
- `progress`: `node`, `prompt_id`, `value`, `max`
- `status`: `exec_info`（含 `queue_remaining`）
