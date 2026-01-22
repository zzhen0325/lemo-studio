## 任务概览
更新 Google Gemini 模型的注册信息及显示名称：
1. 将现有的 `gemini-3-pro-image-preview` 显示名称从 "Nano banana" 升级为 "Nano banana pro"。
2. 新增 `gemini-2.5-flash-preview-image` 模型，显示名称为 "Nano banana"。

## 实施步骤

### 1. 更新 AI 模型注册表
- 修改 [registry.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/lib/ai/registry.ts)：
    - 在 `REGISTRY` 数组中新增 `gemini-2.5-flash-preview-image` 的配置，包含文本、视觉和图像任务能力。

### 2. 更新 UI 显示名称与模型列表
- 修改 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/hooks/features/PlaygroundV2/useGenerationService.ts)：
    - 更新 `AVAILABLE_MODELS` 数组：
        - 将 `gemini-3-pro-image-preview` 的 `displayName` 修改为 "Nano banana pro"。
        - 新增 `gemini-2.5-flash-preview-image`，`displayName` 为 "Nano banana"。

### 3. 更新持久化配置
- 修改 [providers.json](file:///Users/bytedance/Desktop/seeseezz/gulux/data/api-config/providers.json)：
    - 在 `provider-google` 的 `models` 列表中同步更新上述名称和新增模型。
    - 确保 `providerType` 正确设置为 `google-genai`。

### 4. 适配模型逻辑
- 修改 [data-mapping.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/lib/adapters/data-mapping.ts)：
    - 将 `gemini-2.5-flash-preview-image` 加入 `RATIO_BASED_MODELS` 集合。
    - 更新 `toUnifiedConfigFromLegacy` 的映射逻辑，确保 "Nano banana" 指向新模型，"Nano banana pro" 指向旧模型。
- 修改 [ControlToolbar.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/components/features/playground-v2/ControlToolbar.tsx)：
    - 在模型下拉菜单过滤和默认尺寸设置逻辑中包含新模型。

## 验证计划
- 检查 Playground 界面中的模型选择下拉框，确认名称已正确更新且新模型已出现。
- 尝试切换模型，观察控制栏是否能正确识别并显示。
- 确认后端注册逻辑能正确识别新模型 ID。