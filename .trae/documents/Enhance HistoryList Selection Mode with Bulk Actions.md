## 功能增强：HistoryList 选择模式操作栏

在历史记录（HistoryList）的选择模式下，增强操作栏功能，支持全选、取消、移动到项目及批量操作确认。

### 1. 状态管理与逻辑实现
- **MobX 集成**：将 `HistoryList.tsx` 转换为 `observer` 组件，以便实时监听 `projectStore` 中的项目列表变化。
- **选择逻辑**：
    - **全选**：实现 `handleSelectAll` 函数，将当前所有历史记录的 ID 加入 `selectedIds`。
    - **取消全选**：实现 `handleDeselectAll` 函数，清空 `selectedIds`。
- **项目操作**：
    - 实现 `handleMoveToProject(projectId: string)`：将选中的记录批量移动到指定项目。
    - 实现 `handleCreateProjectAndMove(name: string)`：创建新项目并移动选中记录。

### 2. UI 界面调整 (HistoryList.tsx)
- **选择模式操作组**：当 `isSelectionMode` 为 `true` 时，在“选择模式”按钮左侧动态插入以下按钮：
    - **全选按钮**：显示“Select All”，点击执行全选。
    - **取消按钮**：显示“Deselect”，点击清空当前选择。
- **项目操作组**：在“选择模式”按钮右侧（或作为独立组）增加：
    - **Add to 按钮 (DropdownMenu)**：
        - 下拉列表展示 `projectStore.sortedProjects`。
        - 底部提供“+ New Project”选项（触发现有的 `AddToProjectDialog` 或内联输入）。
    - **Confirm 按钮**：用于确认批量操作或退出选择状态，仅在有选中项时启用。
- **布局优化**：使用 `framer-motion` 的 `AnimatePresence` 实现按钮组的平滑滑入滑出效果，保持工具栏简洁。

### 3. 组件复用
- 利用现有的 `AddToProjectDialog.tsx` 处理复杂的新建项目逻辑，确保功能一致性。
- 使用 `DropdownMenu` 原生组件实现“Add to”下拉功能。

### 4. 验证
- 验证全选/取消功能是否正确更新 UI。
- 验证“Add to”下拉列表是否正确显示现有项目。
- 验证移动到项目后，数据是否在 `ProjectSidebar` 中同步更新。

---
请确认以上方案，完成后我将开始实施。