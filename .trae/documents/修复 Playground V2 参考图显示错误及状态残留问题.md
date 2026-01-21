## 问题分析
当前存在两个核心问题：
1. **参考图残留**：当用户清空 UI 中的参考图后，由于 Store 中的 `isEdit` 和 `editConfig` 状态未被同步重置，生成逻辑会错误地从旧的编辑配置中提取参考图，导致历史记录中出现已删除的图片。
2. **历史记录显示异常**：在批量生成或重新生成时，生成服务过分依赖实时 Store 状态而非触发时刻的参数。在异步上传或批量延迟执行过程中，Store 状态的变化导致多个生成任务读取到了相同的（或最新的）参考图列表，从而在历史记录中显示错误的图片。

## 修复方案

### 1. 状态管理优化 (Store)
- 在 [playground-store.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/lib/store/playground-store.ts) 中，优化 `setUploadedImages` 逻辑。
- 当 `uploadedImages` 被清空时，自动重置 `config.isEdit`、`config.editConfig` 和 `config.parentId`，确保干净的状态切换。

### 2. 生成服务逻辑修复 (Hooks)
- 修改 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/hooks/features/PlaygroundV2/useGenerationService.ts)：
    - 在 `handleUnifiedImageGen` 和 `handleWorkflow` 中，**优先使用传入的 `sourceImageUrls` 参数**。只有在参数为空时才回退到 Store 状态。
    - 确保 `handleGenerate` 在构建 `loadingGen` 卡片和执行任务时，使用的参考图数据来源完全一致。
    - 严格校验 `isEdit` 模式下的参考图回退逻辑，避免在非编辑意图下使用旧的 `editConfig`。

### 3. 页面交互逻辑完善 (Pages)
- 修改 [playground.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/playground.tsx)：
    - 完善 `removeImage` 回调，在移除最后一张图片时显式调用状态重置。
    - 优化 `handleRegenerate`（重新生成/应用）逻辑，确保 `applyImages` 完成后再触发生成，并确保传递正确的 `sourceImageUrls`。
    - 统一批量生成的参数捕获，避免在 `setTimeout` 延迟执行时读取到变化的 Store 状态。

## 验证步骤
1. **手动上传验证**：上传一张图片 -> 生成 -> 检查历史记录图片是否正确。
2. **清空验证**：删除所有参考图 -> 点击生成 -> 确认历史记录中不再出现已删除的图片。
3. **重新应用验证**：点击历史记录中的“重新生成” -> 确认 UI 正确加载原图，且生成结果与原参数一致。
4. **批量生成验证**：设置 Batch Size > 1 -> 点击生成 -> 确认该组内所有图片对应的参考图记录一致且正确。

请确认以上方案，我将开始实施修复。