# 文件行数检查报告

- 生成时间：2026-03-06T08:46:36.517Z
- 根目录：/Users/bytedance/Desktop/seeseezz/gulux
- 阈值：500 行
- 严格模式：否
- 扫描文件数：337
- 总行数：58541

## 超标文件清单

| 序号 | 文件路径 | 行数 | 超出行数 | 建议拆分方向 |
| ---- | -------- | ---- | -------- | ------------ |
| 1 | app/infinite-canvas/_components/InfiniteCanvasEditor.tsx | 2918 | 2418 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 2 | app/studio/playground/_components/containers/PlaygroundPageContainer.tsx | 1677 | 1177 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 3 | lib/ai/providers.ts | 1613 | 1113 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 4 | app/studio/playground/_components/Banner/BannerModePanel.tsx | 1592 | 1092 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 5 | components/image-editor/hooks/use-fabric-image-editor.ts | 1328 | 828 | 自定义 Hook 逻辑过于庞大，建议拆分为多个职责单一的 hooks，并将通用工具提取到独立 util 文件。 |
| 6 | app/studio/playground/_components/hooks/useImageEditor.ts | 1301 | 801 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 7 | app/studio/dataset/_components/CollectionDetail.tsx | 984 | 484 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 8 | app/studio/playground/_components/hooks/useGenerationService.ts | 935 | 435 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 9 | app/infinite-canvas/_components/CanvasNodeCard.tsx | 895 | 395 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 10 | app/studio/settings/_components/ProviderFormModal.tsx | 867 | 367 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 11 | app/studio/playground/_components/GalleryView.tsx | 843 | 343 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 12 | app/studio/playground/_components/history/HistoryCards.tsx | 841 | 341 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 13 | app/studio/playground/_components/Dialogs/PresetManagerDialog.tsx | 787 | 287 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 14 | app/studio/mapping-editor/_components/mapping-editor-page.tsx | 748 | 248 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 15 | app/studio/settings/_components/SettingsView.tsx | 748 | 248 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 16 | app/studio/dataset/_components/collection-detail/useCollectionDetailAiWorkflow.tsx | 722 | 222 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 17 | app/studio/playground/_components/PlaygroundInputSection.tsx | 667 | 167 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 18 | app/studio/playground/_components/ControlToolbar.tsx | 590 | 90 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 19 | app/studio/dataset/_components/collection-detail/CollectionDetailHeader.tsx | 569 | 69 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 20 | lib/store/playground-store.ts | 555 | 55 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 21 | server/service/api-config.service.ts | 553 | 53 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 22 | app/studio/playground/_components/StyleDetailView.tsx | 552 | 52 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 23 | lib/store/playground-store.library-actions.ts | 516 | 16 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 24 | app/studio/mapping-editor/_components/workflow-analyzer.tsx | 507 | 7 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 25 | app/studio/tools/_components/ParameterPanel.tsx | 505 | 5 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |

## Top 50 按行数排序的文件

| 序号 | 文件路径 | 行数 |
| ---- | -------- | ---- |
| 1 | app/infinite-canvas/_components/InfiniteCanvasEditor.tsx | 2918 |
| 2 | app/studio/playground/_components/containers/PlaygroundPageContainer.tsx | 1677 |
| 3 | lib/ai/providers.ts | 1613 |
| 4 | app/studio/playground/_components/Banner/BannerModePanel.tsx | 1592 |
| 5 | components/image-editor/hooks/use-fabric-image-editor.ts | 1328 |
| 6 | app/studio/playground/_components/hooks/useImageEditor.ts | 1301 |
| 7 | app/studio/dataset/_components/CollectionDetail.tsx | 984 |
| 8 | app/studio/playground/_components/hooks/useGenerationService.ts | 935 |
| 9 | app/infinite-canvas/_components/CanvasNodeCard.tsx | 895 |
| 10 | app/studio/settings/_components/ProviderFormModal.tsx | 867 |
| 11 | app/studio/playground/_components/GalleryView.tsx | 843 |
| 12 | app/studio/playground/_components/history/HistoryCards.tsx | 841 |
| 13 | app/studio/playground/_components/Dialogs/PresetManagerDialog.tsx | 787 |
| 14 | app/studio/mapping-editor/_components/mapping-editor-page.tsx | 748 |
| 15 | app/studio/settings/_components/SettingsView.tsx | 748 |
| 16 | app/studio/dataset/_components/collection-detail/useCollectionDetailAiWorkflow.tsx | 722 |
| 17 | app/studio/playground/_components/PlaygroundInputSection.tsx | 667 |
| 18 | app/studio/playground/_components/ControlToolbar.tsx | 590 |
| 19 | app/studio/dataset/_components/collection-detail/CollectionDetailHeader.tsx | 569 |
| 20 | lib/store/playground-store.ts | 555 |
| 21 | server/service/api-config.service.ts | 553 |
| 22 | app/studio/playground/_components/StyleDetailView.tsx | 552 |
| 23 | lib/store/playground-store.library-actions.ts | 516 |
| 24 | app/studio/mapping-editor/_components/workflow-analyzer.tsx | 507 |
| 25 | app/studio/tools/_components/ParameterPanel.tsx | 505 |
| 26 | app/studio/playground/_components/Dialogs/ImagePreviewModal.tsx | 491 |
| 27 | lib/api/comfyui-api-service.ts | 484 |
| 28 | components/ui/gradient-shader-card.tsx | 460 |
| 29 | lib/store/api-config-store.ts | 443 |
| 30 | app/studio/playground/_components/HistoryList.tsx | 434 |
| 31 | server/service/dataset.service.ts | 432 |
| 32 | server/service/infinite-canvas.service.ts | 423 |
| 33 | lib/prompt/banner-prompt.ts | 422 |
| 34 | lib/model-center.ts | 419 |
| 35 | lib/api/comfyui-service.ts | 392 |
| 36 | lib/api/viewcomfy-api-services.ts | 388 |
| 37 | app/studio/mapping-editor/_components/parameter-mapping-panel.tsx | 384 |
| 38 | lib/local-storage-manager.ts | 375 |
| 39 | components/image-editor/ImageEditDialog.tsx | 347 |
| 40 | components/visual-effects/GradualBlur.tsx | 346 |
| 41 | server/db/models.ts | 329 |
| 42 | components/visual-effects/ColorBends.tsx | 328 |
| 43 | server/service/translate.service.ts | 324 |
| 44 | app/studio/playground/_components/StyleCollageEditor.tsx | 314 |
| 45 | components/ui/dotted-glow-background.tsx | 308 |
| 46 | config/banner-templates.ts | 292 |
| 47 | components/visual-effects/PixelCard.tsx | 290 |
| 48 | server/service/history.service.ts | 289 |
| 49 | app/infinite-canvas/_components/InfiniteCanvasProjectSidebar.tsx | 287 |
| 50 | tests/model-center.spec.ts | 279 |

> 提示：建议将单文件控制在 100~300 行之间，超过阈值的文件优先评估拆分。
