我将通过以下步骤在历史记录卡片中添加生成进度显示：

1. **扩展** **`Generation`** **接口**：

   * 修改 `types/database.ts`，为 `Generation` 接口添加 `progress` (number) 和 `progressStage` (string) 字段，用于存储进度百分比和当前阶段描述。

2. **更新** **`HistoryList.tsx`**：

   * 在 `components/features/playground-v2/HistoryList.tsx` 中找到用户指定的代码段（第 602-623 行，即卡片头部信息栏）。

   * 在信息栏末尾添加条件渲染逻辑：当 `result.status === 'pending'` 时，显示进度信息。

   * **UI 实现**：

     * 使用 `span` 标签显示百分比（例如 `45%`）和阶段描述（例如 `Denoising`）。

     * 添加 `text-primary`（亮绿色）和 `animate-pulse`（脉冲动画）样式，使其在视觉上明显的表示“进行中”状态。

     * 如果没有具体进度数据，默认显示 "Generating..."。

**涉及文件**：

* `types/database.ts`: 添加类型定义。

* `components/features/playground-v2/HistoryList.tsx`: 实现 UI 显示逻辑。

