# 工作流映射编辑器 (Mapping Editor) - Technical Analysis

## 1. 模块定位
Mapping Editor 是连接 ComfyUI 复杂后端与 Lemo AI Studio 简洁前端的桥梁。它允许开发者/高级用户导入 ComfyUI API JSON，并将其节点参数“映射”为前端 UI 组件（如滑块、输入框、下拉选单）。

## 2. 核心架构

### 2.1 文件构成
- **入口**: `pages/mapping-editor-page.tsx`
- **核心组件**:
  - `WorkflowAnalyzer`: 解析 JSON 结构，展示可映射的节点树。
  - `ParameterMappingPanel`: 右侧属性面板，配置 UI 组件属性（Label, Min/Max, Default）。
  - `MappingList`: 已创建的映射组件列表预览。
  - `NodeConfigurationDialog`: 节点深度调试/配置弹窗。

### 2.2 工作流程
1. **导入 (Import)**:
   - 用户上传 `workflow_api.json`。
   - `initializeEditor` 解析 JSON，初始化 `MappingConfig` 对象。
2. **分析 (Analyze)**:
   - `WorkflowAnalyzer` 遍历 JSON 中的 Nodes，提取 `inputs`。
   - 用户点击某个 Input (e.g., `seed`) -> 触发选中状态。
3. **映射 (Map)**:
   - 用户在 `ParameterMappingPanel` 选择组件类型 (e.g., `Slider`)。
   - 设置显示名称、范围、步长。
   - 点击 "Create Component" -> 生成 `UIComponent` 对象并存入配置。
4. **保存 (Save)**:
   - 配置被保存到 `view-comfy` API (服务端存储) 和 LocalStorage (本地备份)。
   - 保存的数据结构包含 `workflowApiJSON` (原始流) 和 `uiConfig` (前端定义)。

## 3. 数据结构

### UIComponent
```typescript
interface UIComponent {
  id: string;
  type: 'Input' | 'Slider' | 'Select' | 'Switch' | 'ImageUpload';
  properties: {
    label: string;
    paramName: string; // 对应 Playground 的 config key (e.g., "img_width")
    defaultValue?: any;
    // ... specific props like min, max, options
  };
  mapping: {
    workflowPath: string[]; // e.g., ["3", "inputs", "seed"]
    targetType: string;
  };
}
```

## 4. 关键技术点
- **Local Storage Management**: `localStorageManager` 用于处理自动保存和防丢失机制。
- **Auto-Save**: `useEffect` 监听 `isDirty` 状态，每 30 秒触发一次自动保存。
- **Validation**: 在导入 JSON 时会进行简单的 schema 校验。

## 5. 优化建议

1. **可视化增强**:
   - 目前 `WorkflowAnalyzer` 可能以列表/树形展示，建议集成 **React Flow** 渲染实际的节点连接图，提升可视化体验。
2. **类型安全**:
   - 增强对 ComfyUI 自定义节点的类型推断，避免映射不兼容的数据类型。
3. **即时预览**:
   - 在编辑器内部增加一个 "Preview Mode"，实时渲染生成的 UI 面板，无需跳转到 Playground 验证。
