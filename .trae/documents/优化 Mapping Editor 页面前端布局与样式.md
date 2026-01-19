## 优化 Mapping Editor 页面前端布局与样式

我们将对 [mapping-editor-page.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/mapping-editor-page.tsx) 进行全面的 UI/UX 升级，使其更符合专业工作流配置工具的格调，提升操作体验。

### 1. 布局结构重构 (Layout Refactoring)
- **侧边栏工作流导航**：将顶部的水平 Tabs 替换为左侧的可折叠边栏，方便管理多个工作流，避免水平排列拥挤。
- **响应式可调节面板**：使用 [resizable.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/components/ui/resizable.tsx) 重新组织 `WorkflowAnalyzer` 和 `ParameterMappingPanel`。用户可以自由调整节点列表和配置面板的宽度，优化工作空间。
- **沉浸式顶部栏**：优化顶部导航栏，使其具有毛玻璃效果 (Backdrop Blur)，并包含配置保存状态指示。

### 2. 视觉风格升级 (Visual Enhancement)
- **毛玻璃主题 (Glassmorphism)**：统一全页面的背景风格，使用 `bg-white/[0.02]`、`backdrop-blur-xl` 和极细的 `border-white/5` 边框，营造现代感和层次感。
- **动态背景集成**：在页面背景中引入 `AuroraBackground` 或类似的动态背景效果，提升页面的高级感。
- **高级卡片效果**：在工作流上传区域和空状态展示中使用 `MagicCard` 或 `WarpFlowCard`，增强视觉吸引力。
- **专业字体应用**：对节点 ID、参数名等技术信息应用 `Fira Code` 或单色等宽字体，提升专业度。

### 3. 用户体验优化 (UX Polish)
- **全新上传/空状态**：重新设计未加载工作流时的界面。将上传文件和从服务器加载的操作整合进一个美观的引导区域，减少用户的困惑。
- **操作反馈增强**：优化按钮的 Hover 态和 Active 态。为保存操作添加更明显的加载和成功反馈。
- **平滑动画过渡**：利用 `framer-motion` 为页面切换和面板展开添加平滑的过渡动画。

### 4. 代码结构优化 (Code Optimization)
- **状态管理精简**：清理冗余的样式代码，统一使用 Tailwind 变量。
- **组件拆分**：将过于复杂的内联 JSX 提取为小的子组件，提高代码的可维护性。

---

是否现在开始执行这些优化？