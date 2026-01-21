## 修复步骤

### 1. 修复主页面重试逻辑 (pages/playground.tsx)
- 修改 `HistoryList` 的 `onRegenerate` 属性，使其指向 `handleRegenerate`。
- 增强 `handleRegenerate`：在调用 `handleGenerate` 之前，先调用 `applyImages` 将历史图片同步到 Store。

### 2. 完善参数回填逻辑 (components/features/playground-v2/HistoryList.tsx)
- 更新 `Use All` 按钮的逻辑：
    - 使用 `applyModel` 回填完整的 `config` 对象。
    - 无论历史记录是否有图片，都通过 `applyImages` 更新 `uploadedImages`（若无图片则传空数组以实现覆盖）。
    - 确保 `loras` 等数组字段正确回填。

### 3. 修复画廊视图重试逻辑 (components/features/playground-v2/GalleryView.tsx)
- 接入 `useGenerationService`。
- 将 `Rerun` 按钮改为执行完整的参数应用 + 触发生成流程，而不仅仅是修改 UI 状态。

### 4. 验证参数匹配
- 确保 `sourceImageUrls` 在 `handleRegenerate` 和 `handleGenerate` 之间正确传递。
- 检查 `editConfig` 在重试时是否被正确保留，以支持编辑任务的重试。

## 关键代码变动点预读

### pages/playground.tsx
```typescript
const handleRegenerate = async (result: Generation) => {
  // 1. 同步参考图
  const sourceUrls = result.sourceImageUrls || ...;
  await applyImages(sourceUrls); // 关键：确保生成前图片已在 Store 中

  // 2. 构造配置并触发
  const fullConfig = { ...config, ...result.config, ... };
  await handleGenerate({ configOverride: fullConfig });
};
```

### HistoryList.tsx
```typescript
// Use All 逻辑
applyModel(config.model, { ...config });
applyImages(sourceUrls); // 覆盖当前图片
```
