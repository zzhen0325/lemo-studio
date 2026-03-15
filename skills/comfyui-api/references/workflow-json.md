# Workflow JSON 与 API Format

## 1. Workflow JSON（UI 格式）
ComfyUI 的 workflow JSON 有明确的 schema 与 `version` 字段规范，官方文档提供了结构说明与 JSON Schema。该格式主要用于 UI 侧的工作流保存与还原（包含 UI 布局与连接信息）。

## 2. API Format（用于 API 调用）
ComfyUI Cloud 文档明确指出：API 调用应使用 **API format** 的 workflow（在 UI 中“Save (API Format)”导出）。该格式以节点 ID 为键，包含 `class_type` 和 `inputs` 等字段。

## 3. 实操建议
- 需要 API 调用时，优先从 UI 导出 **API format**。
- 若只有 UI 的 workflow JSON，需转换为 API format 再调用 API。
