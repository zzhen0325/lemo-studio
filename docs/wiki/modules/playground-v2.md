# 创作工坊 (Playground V2) - Technical Analysis

## 1. 模块定位
Playground V2 是 Lemo AI Studio 的核心功能区，提供了一个集成的图像生成环境。它不仅支持简单的文生图，还集成了高级的工作流（ComfyUI）执行能力和参数映射。

## 2. 核心架构

### 2.1 文件构成
- **入口**: `pages/playground-v2.tsx` ( `PlaygroundV2Page` )
- **状态管理**: 
  - `lib/store/playground-store.ts` (Config, Uploaded Images, Selected Models)
  - `useState` (Generation History, UI Toggles)
- **子组件**:
  - `ControlToolbar`: 左侧/底部控制栏，参数设置。
  - `PromptInput`: 提示词输入，集成 LLM 优化。
  - `HistoryList`: 生成历史记录展示与管理。
  - `ImagePreviewModal` / `ImageEditorModal`: 图片预览与二次编辑。

### 2.2 数据流向 (Data Flow)
1. **配置变更**: 用户在 `ControlToolbar` 修改参数 -> 更新 `PlaygroundStore`。
2. **任务触发**: 点击 Generate -> `handleGenerate` -> 创建临时 Task ID -> 添加到 `generationHistory`。
3. **后台执行**: 调用 `executeBackgroundGeneration`:
   - **Nano banana (Mock/Edit)**: 本地模拟或简单编辑接口。
   - **Seed 4.0 (Coze)**: 上传参考图 -> 调用 Coze API -> 轮询结果。
   - **Workflow (ComfyUI)**: 
     - 解析 `WorkflowConfig`。
     - 将 UI 参数 (Prompt, Size, Lora) 映射到 ComfyUI Node Input。
     - 通过 WebSocket/HTTP 发送任务至 ComfyUI。
4. **结果处理**: 生成成功 -> 更新 History Item -> 上传/保存图片 -> Toast 通知。

## 3. 关键逻辑解析

### 3.1 参数映射 (Parameter Mapping)
在 `executeBackgroundGeneration` 中，如果是 Workflow 模式：
```typescript
// 伪代码逻辑
const mapping = currentWorkflowConfig.viewComfyJSON.mappingConfig;
components.forEach(comp => {
  // 根据 workflowPath (e.g. ["3", "inputs", "seed"]) 找到对应节点
  // 将 Store 中的值 (config.seed) 注入到 API Payload 中
});
```
这使得 UI 可以解耦于底层 ComfyUI 节点结构。

### 3.2 异步任务队列
目前实现为前端伪队列：
- `handleGenerate` 立即返回，不阻塞 UI。
- 每个任务独立维护状态 (`isLoading`, `imageUrl`, `error`)。
- 局限性：页面刷新会丢失正在进行的任务状态（因为是内存变量）。

## 4. 优化建议

1. **逻辑抽离**: 
   - 将 `executeBackgroundGeneration` 及其庞大的 `Switch-Case` 逻辑抽离为 `hooks/useGenerationService.ts`。
   - 将图片上传逻辑 (`handleFilesUpload`, `handleImageUpload`) 抽离为 `hooks/useImageUpload.ts`。

2. **状态增强**:
   - `generationHistory` 应移入 Zustand 或 IndexedDB，以支持持久化。
   - 增加 "任务重试" 机制，应对网络波动。

3. **渲染性能**:
   - `HistoryList` 在包含大量高清图时可能卡顿，建议引入虚拟滚动 (Virtual Scrolling)。
