# 实施方案：消除异步瀑布流 (Eliminating Waterfalls)

我们将针对项目中存在的三个关键异步瓶颈进行优化，通过并行化操作提升性能。

## 1. 并行化页面初始化
**文件**: [mapping-editor-page.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/mapping-editor-page.tsx)
- **现状**: `useEffect` 中顺序执行 `initializeEditor()` 和 `fetchWorkflows()`。
- **优化**: 使用 `Promise.all([initializeEditor(), fetchWorkflows()])` 同时启动两个初始化任务，减少首屏等待时间。

## 2. 并行化生成图片保存
**文件**: [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/hooks/features/PlaygroundV2/useGenerationService.ts)
- **现状**: 在 `handleUnifiedImageGen` 的流式处理中，使用 `for...of` 循环配合 `await` 逐个保存图片。
- **优化**: 改用 `Promise.all` 处理 `chunk.images` 的保存操作，使多图生成时的保存过程由串行转为并行，降低处理延迟。

## 3. 优化 API 批量操作
**文件**: [history/route.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/app/api/history/route.ts)
- **现状**: `POST` 请求中的 `batch-update` 动作使用 `for...of` 循环逐个 `await` 更新元数据文件。
- **优化**: 将循环内的文件写入操作封装为 Promise 数组，使用 `Promise.all` 并行执行磁盘写入，大幅提升批量更新历史记录的速度。

请确认以上方案，我将立即开始实施。