# Project Lemo AI Studio - Technical Wiki

## 1. 架构概览 (Architecture Overview)

### 技术栈 (Tech Stack)
- **Frontend Framework**: [Next.js 14+](https://nextjs.org/) (Hybrid App & Pages Router)
- **Language**: TypeScript
- **State Management**: 
  - Global: [Zustand](https://github.com/pmndrs/zustand) (`usePlaygroundStore`)
  - Shared Context: React Context (`TabContext`)
- **Styling**: 
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Framer Motion](https://www.framer.com/motion/) (UI Animations)
  - [GSAP](https://greensock.com/gsap/) (Complex Parallax Effects)
- **API Integration**: RESTful API Proxy (`/api/*`) connecting to:
  - ComfyUI (Local/Remote)
  - Coze (ByteDance)
  - ByteArtist (Internal)

### 目录结构 (Directory Structure)
- **/app**: Main application layout and routes (Next.js App Router).
  - `page.tsx`: Core entry point managing the "One-Page App" tab system.
- **/pages**: Feature-specific pages (Legacy/compat).
- **/components**:
  - `features/`: Module-specific components (Playground, Dataset, Tools).
  - `ui/`: Reusable UI kit (Buttons, Inputs, Dialogs).
  - `layout/`: Sidebar, Global wrappers.
- **/lib**: Utilities, API clients, Type definitions, and Stores.

## 2. 核心模块 (Core Modules)

| 模块名称 | 描述 | 关键文件 |
| :--- | :--- | :--- |
| **[创作工坊 (Playground V2)](./modules/playground-v2.md)** | 核心图像生成界面，支持多种模型与工作流。 | `pages/playground-v2.tsx` |
| **[工作流映射 (Mapping Editor)](./modules/mapping-editor.md)** | ComfyUI 节点参数可视化映射配置工具。 | `pages/mapping-editor-page.tsx` |
| **[数据集管理 (Dataset Manager)](./modules/dataset-manager.md)** | 图像训练素材的管理、处理与导出。 | `DatasetManagerView.tsx` |
| **[特效工具 (WebGL Tools)](./modules/webgl-tools.md)** | 基于 WebGL 的实时图像处理工具箱。 | `ToolsView.tsx` |

## 3. 优化建议 (Optimization Suggestions)

### 3.1 架构层面
- **路由标准化**: 建议将目前的 Hash-based Tab 切换 (`window.location.hash`) 迁移至标准的 Next.js 路由，以利用 SSR 和更好的历史记录管理。
- **状态持久化**: 将 `generationHistory` 等关键本地状态移至 Zustand 并开启 `persist`，防止页面刷新丢失数据。

### 3.2 代码质量
- **组件拆分**: `PlaygroundV2Page.tsx` 代码量较大，建议拆分 `UploadManager` 和 `GenerationPipeline` 逻辑。
- **性能优化**: 首页 GSAP 视差动画建议使用 `requestAnimationFrame` 节流，减少主线程压力。

### 3.3 用户体验
- **生成反馈**: 增加针对 ComfyUI 长任务的 WebSocket 进度条支持。
