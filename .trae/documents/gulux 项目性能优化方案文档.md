# 项目性能优化方案文档 (基于 Vercel React 最佳实践)

本优化方案基于 `vercel-react-best-practices` 技能对项目进行的深度分析，旨在提升应用的响应速度、减少包体积并优化渲染性能。

## 1. 消除异步瀑布流 (Eliminating Waterfalls) - **关键**
异步瀑布流是导致页面加载缓慢的主要原因。

- **并行初始化**: 在 [mapping-editor-page.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/mapping-editor-page.tsx) 中，`initializeEditor` 和 `fetchWorkflows` 目前是顺序执行的。应改用 `Promise.all` 并行执行。
- **循环内并行处理**: 在 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/hooks/features/PlaygroundV2/useGenerationService.ts) 的 `handleUnifiedImageGen` 函数中，保存图片的循环操作可以并行化，以加快多图生成时的响应速度。
- **API 优化**: 检查 [history/route.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/app/api/history/route.ts) 等 API 路由，确保数据库/文件系统操作尽可能并行。

## 2. 包体积优化 (Bundle Size Optimization) - **关键**
项目包含多个重型交互组件，一次性加载会增加首屏负载。

- **动态导入重型模态框**: 在 [playground.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/playground.tsx) 中，将 `ImageEditorModal`、`LoraSelectorDialog`、`PresetManagerDialog` 等重型组件改为 `next/dynamic` 异步加载，仅在用户触发时加载。
- **第三方库按需加载**: `gsap` 和 `Flip` 等大型库可以考虑在特定的动画组件中动态导入，而不是在页面顶层引入。

## 3. 渲染性能优化 (Rendering Performance) - **高**
- **列表内容可见性**: 在 [GalleryView.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/components/features/playground-v2/GalleryView.tsx) 中，为长列表项添加 `content-visibility: auto`。这可以跳过视口外元素的渲染，显著提升滚动性能。
- **条件渲染规范**: 将 JSX 中的 `{condition && <Component />}` 统一替换为三元运算符 `{condition ? <Component /> : null}`，以避免 React 在某些边缘情况下渲染 `0` 或 `NaN`。
- **SVG 精度优化**: 检查项目中的自定义 SVG 图标，降低坐标精度以减少文件体积。

## 4. 重绘与状态优化 (Re-render Optimization) - **中**
- **依赖项精简**: 在 `GalleryView` 的 `IntersectionObserver` 效果中，使用 `useRef` 存储最新的 `hasMoreGallery` 和 `isFetchingGallery` 状态，避免因这些状态变化而频繁重新创建观察者。
- **Memo 化组件**: 确保 `GalleryView` 中的图片项（Card）和 `StyleStackCard` 使用 `React.memo`，避免列表刷新时所有子项无谓的重绘。
- **派生状态优化**: 检查是否可以直接根据原始数据计算布尔值，而不是在状态中存储冗余的布尔标记。

## 5. 数据获取优化 (Client-Side Data Fetching) - **中**
- **引入 SWR/React Query**: 对于工作流列表、历史记录等数据，建议引入 `SWR`。它能提供自动的请求去重、缓存和后台静默更新，显著提升用户感知的速度。
- **预加载策略**: 在侧边栏导航或常用操作按钮上添加 `onMouseEnter` 预加载逻辑，提前加载可能需要的 API 数据或组件包。

## 6. JavaScript 执行优化 (JavaScript Performance) - **低**
- **Map 查找优化**: 在 [useGenerationService.ts](file:///Users/bytedance/Desktop/seeseezz/gulux/hooks/features/PlaygroundV2/useGenerationService.ts) 的输入映射逻辑中，确保使用 `Map` 进行 O(1) 复杂度的查找，而不是在循环中频繁调用 `find`。
- **及早退出**: 检查复杂逻辑函数，确保在不满足条件时尽早 `return`，减少嵌套深度。

---
**实施建议**: 优先处理第 1、2 类 critical 优化，可立竿见影地提升用户体验。
