## 1. 修改 `PlaygroundInputSection` 组件以支持 `mini` 变体
- 在 [PlaygroundInputSection.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/PlaygroundInputSection.tsx) 的 `PlaygroundInputSectionProps` 接口中添加可选的 `variant?: 'default' | 'mini'` 属性。
- 在组件实现中根据 `variant === 'mini'` 条件：
    - 隐藏位于输入框右上角的提示词优化按钮（`Sparkles` 图标按钮）。
    - 隐藏底部的 `DescribePanel` 渲染逻辑。
    - 将 `variant` 属性透传给 `ControlToolbar` 子组件。

## 2. 修改 `ControlToolbar` 组件
- 在 [ControlToolbar.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/ControlToolbar.tsx) 的 `ControlToolbarProps` 接口中添加 `variant?: 'default' | 'mini'` 属性。
- 在组件实现中，如果 `variant === 'mini'`，则隐藏 "Presets" 选择按钮及其相关的下拉逻辑。

## 3. 在 `ImageEditorModal` 中应用 `mini` 状态
- 修改 [ImageEditorModal.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/Dialogs/ImageEditorModal.tsx)，在调用 `PlaygroundInputSection` 时传入 `variant="mini"` 属性。

## 验证
- 确认 `ImageEditorModal` 中的输入区域不再显示提示词优化、预设选择和描述面板。
- 确认常规 Playground 页面中的功能保持不变（默认为 `default` 状态）。