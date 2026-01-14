## 为 StyleStacksView 增加拖拽上传自动新建风格功能

为了提升用户体验，我们将为 [StyleStacksView.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/StyleStacksView.tsx) 增加拖拽上传功能。当用户将本地图片拖入该页面时，系统将自动上传这些图片并创建一个新的“风格堆栈”（Moodboard）。

### 1. 功能设计

* **拖拽识别**：在 `StyleStacksView` 的主容器上监听拖拽事件。

* **视觉反馈**：当用户将图片拖入页面时，显示一个全屏的模糊蒙层提示“松开以创建新风格”，并带有上传图标。

* **自动上传**：

  * 过滤掉非图片文件。

  * 将选中的图片并行上传到 `/api/upload`。

* **风格新建**：

  * 上传完成后，自动调用 `addStyle` 方法。

  * 新风格名称默认为 `新风格 ${当前日期}`。

  * 将上传后的图片路径存入该风格的 `imagePaths` 中。

### 2. 技术实现步骤

* **状态管理**：引入 `isDragging` 状态控制拖拽提示蒙层的显示。

* **图标引入**：从 `lucide-react` 引入 `Upload` 图标。

* **拖拽事件处理**：

  * `onDragOver`: 阻止默认行为，设置 `isDragging` 为 `true`。

  * `onDragLeave`: 设置 `isDragging` 为 `false`。

  * `onDrop`: 阻止默认行为，执行上传逻辑并创建新风格。

* **上传逻辑**：使用 `FormData` 调用 `/api/upload` 接口，这与项目中其他模块（如 `playground.tsx`）的上传逻辑保持一致。

* **提示反馈**：集成 `useToast`，在上传开始和完成（或失败）时给用户反馈。

### 3. 代码变更文件

* [StyleStacksView.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/StyleStacksView.tsx)：增加拖拽监听、上传逻辑及蒙层 UI。

* [StyleDetailView.tsx](file:///Users/bytedance/Desktop/seeseezz/lemo-AI-studio/components/features/playground-v2/StyleDetailView.tsx)：保持一致性，也支持拖拽添加图片到当前风格。

您是否同意该方案？如果同意，我将开始执行。
