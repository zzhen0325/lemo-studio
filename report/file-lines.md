# 文件行数检查报告

- 生成时间：2026-01-29T17:54:51.137Z
- 根目录：/workspace/iris_563942ca-82a1-4b40-8469-0b77d8b183bb/Lemon8_ai_studio
- 阈值：500 行
- 严格模式：否
- 扫描文件数：302
- 总行数：48161

## 超标文件清单

| 序号 | 文件路径 | 行数 | 超出行数 | 建议拆分方向 |
| ---- | -------- | ---- | -------- | ------------ |
| 1 | components/features/dataset/CollectionDetail.tsx | 2097 | 1597 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 2 | pages/playground.tsx | 1635 | 1135 | 页面文件过大，建议将复杂布局拆分为多个子组件，并将数据请求与副作用提取到独立 hooks 或 service 模块。 |
| 3 | components/features/playground-v2/HistoryList.tsx | 1339 | 839 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 4 | components/features/playground-v2/Dialogs/TldrawEditorView.tsx | 1315 | 815 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 5 | components/features/playground-v2/hooks/useImageEditor.ts | 1301 | 801 | 自定义 Hook 逻辑过于庞大，建议拆分为多个职责单一的 hooks，并将通用工具提取到独立 util 文件。 |
| 6 | lib/ai/providers.ts | 1243 | 743 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 7 | lib/store/playground-store.ts | 934 | 434 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 8 | components/features/playground-v2/Dialogs/PresetManagerDialog.tsx | 782 | 282 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 9 | pages/mapping-editor-page.tsx | 755 | 255 | 页面文件过大，建议将复杂布局拆分为多个子组件，并将数据请求与副作用提取到独立 hooks 或 service 模块。 |
| 10 | components/features/playground-v2/PlaygroundInputSection.tsx | 667 | 167 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 11 | components/features/playground-v2/GalleryView.tsx | 656 | 156 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 12 | components/animate-ui/primitives/effects/highlight.tsx | 652 | 152 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 13 | components/animate-ui/primitives/radix/dropdown-menu.tsx | 564 | 64 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 14 | components/features/playground-v2/StyleDetailView.tsx | 552 | 52 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 15 | components/features/settings/SettingsView.tsx | 523 | 23 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 16 | components/features/tools/ParameterPanel.tsx | 505 | 5 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |

## Top 50 按行数排序的文件

| 序号 | 文件路径 | 行数 |
| ---- | -------- | ---- |
| 1 | components/features/dataset/CollectionDetail.tsx | 2097 |
| 2 | pages/playground.tsx | 1635 |
| 3 | components/features/playground-v2/HistoryList.tsx | 1339 |
| 4 | components/features/playground-v2/Dialogs/TldrawEditorView.tsx | 1315 |
| 5 | components/features/playground-v2/hooks/useImageEditor.ts | 1301 |
| 6 | lib/ai/providers.ts | 1243 |
| 7 | lib/store/playground-store.ts | 934 |
| 8 | components/features/playground-v2/Dialogs/PresetManagerDialog.tsx | 782 |
| 9 | pages/mapping-editor-page.tsx | 755 |
| 10 | components/features/playground-v2/PlaygroundInputSection.tsx | 667 |
| 11 | components/features/playground-v2/GalleryView.tsx | 656 |
| 12 | components/animate-ui/primitives/effects/highlight.tsx | 652 |
| 13 | components/animate-ui/primitives/radix/dropdown-menu.tsx | 564 |
| 14 | components/features/playground-v2/StyleDetailView.tsx | 552 |
| 15 | components/features/settings/SettingsView.tsx | 523 |
| 16 | components/features/tools/ParameterPanel.tsx | 505 |
| 17 | app/api/dataset/route.ts | 469 |
| 18 | components/features/playground-v2/ControlToolbar.tsx | 460 |
| 19 | components/ui/gradient-shader-card.tsx | 460 |
| 20 | components/features/playground-v2/hooks/useGenerationService.ts | 451 |
| 21 | app/api/history/route.ts | 441 |
| 22 | components/motion-primitives/morphing-dialog.tsx | 423 |
| 23 | components/features/playground-v2/Dialogs/ImagePreviewModal.tsx | 412 |
| 24 | lib/api/viewcomfy-api-services.ts | 393 |
| 25 | components/common/graphics/GradualBlur.tsx | 386 |
| 26 | components/features/playground-v2/ProjectSection/project-sidebar/ProjectSidebar.tsx | 376 |
| 27 | lib/local-storage-manager.ts | 375 |
| 28 | components/features/playground-v2/Dialogs/TldrawShapes.tsx | 364 |
| 29 | components/animate-ui/primitives/animate/tabs.tsx | 360 |
| 30 | components/features/mapping-editor/parameter-mapping-panel.tsx | 358 |
| 31 | components/visual-effects/GradualBlur.tsx | 346 |
| 32 | components/common/graphics/EtherealGradient.tsx | 340 |
| 33 | components/common/graphics/ColorBends.tsx | 329 |
| 34 | components/visual-effects/ColorBends.tsx | 328 |
| 35 | server/service/dataset.service.ts | 322 |
| 36 | components/features/settings/ProviderFormModal.tsx | 314 |
| 37 | components/animate-ui/components/radix/dropdown-menu.tsx | 313 |
| 38 | components/features/playground-v2/StyleCollageEditor.tsx | 312 |
| 39 | lib/api/comfyui-api-service.ts | 310 |
| 40 | components/ui/dotted-glow-background.tsx | 308 |
| 41 | components/visual-effects/PixelCard.tsx | 290 |
| 42 | lib/store/api-config-store.ts | 281 |
| 43 | app/page.tsx | 280 |
| 44 | server/db/models.ts | 278 |
| 45 | components/features/mapping-editor/workflow-analyzer.tsx | 269 |
| 46 | lib/api/viewcomfy-integration.ts | 256 |
| 47 | tests/api/dataset.route.spec.ts | 247 |
| 48 | lib/store/project-store.ts | 246 |
| 49 | styles/globals.css | 246 |
| 50 | components/visual-effects/PixelCard.jsx | 242 |

> 提示：建议将单文件控制在 100~300 行之间，超过阈值的文件优先评估拆分。
