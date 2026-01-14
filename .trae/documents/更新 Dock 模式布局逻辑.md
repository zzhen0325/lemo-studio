# 更新 Dock 布局与按钮逻辑

## 目标
1.  修正 Dock 栏的定位方式，使其受限于主容器内部。
2.  更新 Dock 栏中 History 按钮的交互语义，使其表现为状态切换（Toggle）而非单纯的关闭操作。

## 变更计划
1.  **修改文件**: `pages/playground.tsx`
2.  **调整 Dock 定位**:
    *   找到 Dock 容器的定义（约第 969 行）。
    *   将 `className` 中的 `fixed left-20` 修改为 `absolute left-4`。
    *   这将确保 Dock 栏在渲染时位于 Line 905 的主容器内部，而不是相对于浏览器窗口固定。
3.  **更新 History 按钮逻辑**:
    *   找到 Dock 栏内的 History 按钮（约第 1013 行）。
    *   将 `tooltipContent` 从 `"Hide History"` 修改为 `"History"`，保持与其他按钮（如 Describe）一致的命名风格。
    *   将 `onClick` 事件从 `() => setShowHistory(false)` 修改为 `() => setShowHistory(!showHistory)`，在语义上明确其为切换操作。