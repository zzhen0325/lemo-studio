修改 `components/features/playground-v2/Dialogs/PresetManagerDialog.tsx` 文件，将所有 `SelectContent` 组件的 `className` 属性中添加 `z-[200]`，以确保下拉菜单的层级高于弹窗的 `z-150`。

具体修改点包括：

1. Category 选择器
2. Base Model 选择器
3. 编辑模式下的 Category 选择器
4. Target Resolution 选择器
5. Aspect Ratio 选择器
6. Linked Workflow 选择器

