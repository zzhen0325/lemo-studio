## 现状定位
- 核心问题：`CozeImageProvider` 在流式解析时，Fallback 逻辑过于激进，将不完整的 URL 片段（如 `https://s.coze.cn/t/fl`）误判为有效图片 URL 并发送给前端。
- 前端影响：虽然前端有 `endsWith('/')` 校验，但大量无效 URL 可能干扰逻辑；且用户反馈“没有上传到 CDN”，可能是因为前端并未收到真正“完整且通过去重校验”的 URL，或者后端请求失败但无感知。
- 后端状态：已改造 `/api/save-image` 为上传 CDN，但缺乏日志，难以确认是否收到了请求。

## 修复目标
1. 修复 `CozeImageProvider`：严格限制 Fallback 逻辑，只有当 URL 片段通过正则校验（必须包含结尾斜杠）时才将其作为有效图片发送。
2. 增强可观测性：在 `/api/save-image` 添加调试日志，明确请求参数与执行结果，便于排查“未上传”是前端未发请求还是后端处理失败。

## 实施方案
1. **修复 `lib/ai/providers.ts`**：
   - 修改 `extractImagesFromContent` 方法。
   - 在 Fallback 逻辑（`split(/image:/i)`）中，对于包含 `coze.cn/t/` 的片段，强制要求匹配严格正则（`/https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//i`）。
   - 如果匹配失败（即 URL 不完整），直接跳过，不添加到结果列表。

2. **增强 `app/api/save-image/route.ts`**：
   - 在 `POST` 方法入口添加 `console.log`，打印请求参数摘要（如 `subdir`、`ext`、`imageBase64` 是否为 URL）。
   - 在成功/失败处添加对应的日志。

3. **验证**：
   - 再次运行 Coze 流式生成，观察 Terminal 日志。
   - 预期：不再出现 `.../fl`、`.../fl2` 等刷屏日志，只出现最终完整的 `.../fl2DMJsthyk/`。
   - 预期：看到 `[API] /api/save-image called` 日志，随后是 `[cdn-upload]` 日志。
   - 最终前端展示 CDN 图片。

## 附带优化
- 顺便检查 `utils/cdn.ts` 的日志，确保上传成功时输出清晰的 URL。

确认后将执行代码修改并验证。