## Coze-Seed4 调用全链路梳理

1. **前端触发 (`useGenerationService.ts`)**
   - 用户点击生成，调用 `handleGenerate` -> `callImage`（通过 `useAIService`）。
   - `callImage` 发起 POST `/api/ai/image` 请求，开启流式接收（`stream: true`）。
   - 前端接收到流式 chunk 后，回调 `onStream`（在 `useGenerationService` 中定义）。

2. **后端路由 (`ai.controller.ts` & `ai.service.ts`)**
   - POST `/api/ai/image` 被 `AiController` 接收，透传给 `AiService`。
   - `AiService` 根据 `modelId` ("coze_seed4") 获取 `CozeImageProvider` 实例并调用 `generateImage`。

3. **Provider 实现 (`providers.ts` - CozeImageProvider)**
   - `generateImage` 向 Coze API 发起请求。
   - 收到 SSE 响应后，通过 `ReadableStream` 逐行解析：
     - 累积文本 `accumulatedText`。
     - 调用 `extractImagesFromContent(accumulatedText)` 提取 URL。
     - **关键点**：每当发现新 URL，立即通过 `controller.enqueue` 发送 `{ images: [img] }` 给前端。

4. **前端流式接收与转存 (`useGenerationService.ts`)**
   - `callImage` 的回调接收到 `{ images: [...] }`。
   - 遍历 images，去重后调用 `saveImageToOutputs(imgUrl)`。
   - `saveImageToOutputs` 发起 POST `/api/save-image` 请求。

5. **CDN 转存服务 (`/api/save-image`)**
   - 接收 `imageBase64`（此处是 Coze 的 http URL）。
   - 下载图片 -> 上传 CDN (`uploadBufferToCdn`) -> 返回 `{ path: cdnUrl }`。

## 阻碍原因分析与修复验证

**根本原因**：
之前的 `extractImagesFromContent` 正则过于宽松且 Fallback 逻辑有缺陷，导致 Coze 返回的部分文本（如 `https://s.coze.cn/t/f`）被误判为图片 URL 并推送给前端。前端虽然接收到了，但因 URL 不完整（或之前的去重逻辑/校验逻辑干扰），导致未能正确触发有效的 `saveImageToOutputs`，或者触发了但请求失败（因 URL 无效）。

**已完成的修复**：
1. **Provider 层**：修复了 `extractImagesFromContent`，强制要求 Coze 短链必须以 `/` 结尾才算有效，彻底屏蔽了不完整 URL 的输出。
2. **前端层**：移除了 `useGenerationService` 中对 Coze URL 的“二次校验”（不再要求必须 `endsWith('/')`，完全信任 Provider 清洗后的结果），防止误杀合法的长链接或 CDN 链接。
3. **服务层**：增强了 `/api/save-image` 的日志，确保能观测到请求是否到达及参数详情。

**验证结论**：
经本地验证，现在 Coze 流式只会输出完整的 `https://s.coze.cn/t/.../`，前端接收后能正常触发 `saveImageToOutputs`，后端也能成功下载并上传 CDN。全链路已打通。

**下一步建议**：
无需额外代码修改。目前的修复已覆盖全链路的关键阻塞点。用户只需重新运行生成即可看到修复效果。