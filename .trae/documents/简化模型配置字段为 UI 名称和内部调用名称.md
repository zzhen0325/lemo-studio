我将简化模型配置结构，将其从四个字段（`id`, `displayName`, `modelKey`, `backendModelId`）缩减为两个核心名称：**UI显示名称**（`displayName`）和**内部实际调用名称**（`id`，即原 `backendModelId`）。

### **修改内容概览**

1.  **更新 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/hooks/features/PlaygroundV2/useGenerationService.ts)**
    *   简化 `UnifiedModelConfig` 接口，仅保留 `id` 和 `displayName`。
    *   重构 `AVAILABLE_MODELS` 列表，使用后端模型 ID 作为 `id`。
    *   简化 `handleUnifiedImageGen` 中的查找逻辑，直接使用 `selectedModel` 作为 API 调用的模型 ID。

2.  **更新 [playground-store.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/lib/store/playground-store.ts)**
    *   将默认模型从 `'Nano banana'` 更改为 `'gemini-3-pro-image-preview'`。
    *   更新 `applyModel`、`remix` 和 `resetState` 函数，使其兼容新的模型 ID。

3.  **更新 [data-mapping.ts](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/lib/adapters/data-mapping.ts)**
    *   更新 `RATIO_BASED_MODELS` 集合，包含新的模型 ID。
    *   在 `toUnifiedConfigFromLegacy` 中同步更新模型映射逻辑。

4.  **更新 [ControlToolbar.tsx](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/components/features/playground-v2/ControlToolbar.tsx)**
    *   简化 `useEffect` 和 `handleUnifiedSelectChange` 中的 ID 转换逻辑。
    *   更新 UI 触发器和下拉菜单的显示逻辑。
    *   同步更新分辨率按钮的显示判断逻辑。

5.  **更新 [PresetManagerDialog.tsx](file:///Users/bytedance/Desktop/seeseezz/lemoai_gulux/Lemon8_ai_studio/components/features/playground-v2/Dialogs/PresetManagerDialog.tsx)**
    *   更新 `DEFAULT_CONFIG` 中的默认模型。
    *   更新预设创建时的模型选择器值。

### **技术细节**
*   **统一标识符**：消除 `modelKey` 这一中间层，统一使用 `backendModelId` 作为全流程的标识符。
*   **后向兼容**：在 `data-mapping.ts` 中可以考虑加入简单的旧标识符映射逻辑，以防历史数据加载出错。

确认此方案后，我将开始执行代码修改。