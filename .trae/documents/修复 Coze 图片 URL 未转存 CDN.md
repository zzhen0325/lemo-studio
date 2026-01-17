## 现状定位

* Coze 流式已能解析到图片短链：日志来自 [providers.ts:CozeImageProvider](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/lib/ai/providers.ts#L671-L839)。

* 前端在收到 `chunk.images` 后会尝试“转存”：见 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/hooks/features/PlaygroundV2/useGenerationService.ts#L200-L259)。

* 但 `saveImageToOutputs` 实际请求的是 `${getApiBase()}/save-image`：见 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/hooks/features/PlaygroundV2/useGenerationService.ts#L50-L60)。

* `getApiBase()` 默认 `http://localhost:3000/api`，命中 Next 的 [app/api/save-image](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/app/api/save-image/route.ts#L21-L76)，该实现只写入 `public/outputs`，不会上传 CDN。

* 真正上传 CDN 的逻辑在 GuluX 侧：[save-image.service.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/server/service/save-image.service.ts#L30-L79) + [cdn.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/server/utils/cdn.ts#L62-L86)。

## 修复目标

* 无论当前前端调用的是 Next `/api/save-image` 还是 GuluX `/api/save-image`，最终都能把 Coze 返回的 URL 对应图片上传到 CDN，并把 CDN URL 回传给前端作为 `outputUrl`。

## 实施方案（最小改动优先）

1. 改造 Next 的 `/api/save-image`：

* 将 [app/api/save-image/route.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/app/api/save-image/route.ts#L21-L76) 从“写本地文件”改为“调用 `uploadBufferToCdn` 上传并返回 `cdnRes.url`”。

* 保持现有 zod 校验不变；继续支持 `imageBase64` 同时接收 dataURL/base64/http URL。

* `metadata`：先不落盘（当前转存目标是 CDN），仅作为可选字段原样回传或忽略（按你现有消费方式选更兼容的）。

1. 补强图片 URL 抽取（避免后续遇到带路径的直链图片漏识别）：

* 调整 [providers.ts:extractImagesFromContent](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/lib/ai/providers.ts#L795-L839) 中普通图片 URL 正则（当前排除了 `/`，会漏掉 `https://domain/path/a.png`）。

1. 验证与回归

* 本地启动后走一遍 Coze 流式生成：确认 `useGenerationService` 的 `saveImageToOutputs` 得到的是 CDN URL（而不是 `/outputs/...` 或原始 `https://s.coze.cn/t/.../`）。

* 若 CDN 上传失败：确保前端仍能显示原 URL（现逻辑已 fallback），并在服务端返回明确错误信息便于排查。

##

如果你确认按上述方案执行，我将直接提交相应代码改动并跑通一条端到端验证链路。
