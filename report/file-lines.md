# 文件行数检查报告

- 生成时间：2026-02-26T12:32:07.818Z
- 根目录：/Users/bytedance/Desktop/seeseezz/gulux
- 阈值：500 行
- 严格模式：否
- 扫描文件数：296
- 总行数：46972

## 超标文件清单

| 序号 | 文件路径 | 行数 | 超出行数 | 建议拆分方向 |
| ---- | -------- | ---- | -------- | ------------ |
| 1 | app/studio/playground/_components/containers/PlaygroundPageContainer.tsx | 1522 | 1022 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 2 | app/studio/playground/_components/hooks/useImageEditor.ts | 1301 | 801 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 3 | lib/ai/providers.ts | 1282 | 782 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 4 | app/studio/playground/_components/Banner/BannerModePanel.tsx | 1248 | 748 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 5 | app/studio/dataset/_components/CollectionDetail.tsx | 982 | 482 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 6 | app/studio/playground/_components/history/HistoryCards.tsx | 838 | 338 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 7 | app/studio/playground/_components/GalleryView.tsx | 834 | 334 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 8 | app/studio/playground/_components/Dialogs/TldrawEditorView.tsx | 817 | 317 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 9 | app/studio/playground/_components/Dialogs/PresetManagerDialog.tsx | 786 | 286 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 10 | app/studio/playground/_components/hooks/useGenerationService.ts | 762 | 262 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 11 | app/studio/mapping-editor/_components/mapping-editor-page.tsx | 748 | 248 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 12 | app/studio/dataset/_components/collection-detail/useCollectionDetailAiWorkflow.tsx | 718 | 218 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 13 | app/studio/playground/_components/PlaygroundInputSection.tsx | 667 | 167 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 14 | app/studio/dataset/_components/collection-detail/CollectionDetailHeader.tsx | 569 | 69 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 15 | lib/store/playground-store.ts | 569 | 69 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 16 | app/studio/playground/_components/StyleDetailView.tsx | 552 | 52 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 17 | app/studio/playground/_components/ControlToolbar.tsx | 532 | 32 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 18 | lib/store/playground-store.library-actions.ts | 522 | 22 | 建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。 |
| 19 | app/studio/settings/_components/SettingsView.tsx | 513 | 13 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 20 | app/studio/mapping-editor/_components/workflow-analyzer.tsx | 507 | 7 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |
| 21 | app/studio/tools/_components/ParameterPanel.tsx | 505 | 5 | App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。 |

## Top 50 按行数排序的文件

| 序号 | 文件路径 | 行数 |
| ---- | -------- | ---- |
| 1 | app/studio/playground/_components/containers/PlaygroundPageContainer.tsx | 1522 |
| 2 | app/studio/playground/_components/hooks/useImageEditor.ts | 1301 |
| 3 | lib/ai/providers.ts | 1282 |
| 4 | app/studio/playground/_components/Banner/BannerModePanel.tsx | 1248 |
| 5 | app/studio/dataset/_components/CollectionDetail.tsx | 982 |
| 6 | app/studio/playground/_components/history/HistoryCards.tsx | 838 |
| 7 | app/studio/playground/_components/GalleryView.tsx | 834 |
| 8 | app/studio/playground/_components/Dialogs/TldrawEditorView.tsx | 817 |
| 9 | app/studio/playground/_components/Dialogs/PresetManagerDialog.tsx | 786 |
| 10 | app/studio/playground/_components/hooks/useGenerationService.ts | 762 |
| 11 | app/studio/mapping-editor/_components/mapping-editor-page.tsx | 748 |
| 12 | app/studio/dataset/_components/collection-detail/useCollectionDetailAiWorkflow.tsx | 718 |
| 13 | app/studio/playground/_components/PlaygroundInputSection.tsx | 667 |
| 14 | app/studio/dataset/_components/collection-detail/CollectionDetailHeader.tsx | 569 |
| 15 | lib/store/playground-store.ts | 569 |
| 16 | app/studio/playground/_components/StyleDetailView.tsx | 552 |
| 17 | app/studio/playground/_components/ControlToolbar.tsx | 532 |
| 18 | lib/store/playground-store.library-actions.ts | 522 |
| 19 | app/studio/settings/_components/SettingsView.tsx | 513 |
| 20 | app/studio/mapping-editor/_components/workflow-analyzer.tsx | 507 |
| 21 | app/studio/tools/_components/ParameterPanel.tsx | 505 |
| 22 | app/studio/playground/_components/Dialogs/ImagePreviewModal.tsx | 489 |
| 23 | components/ui/gradient-shader-card.tsx | 460 |
| 24 | app/studio/playground/_components/HistoryList.tsx | 434 |
| 25 | server/service/dataset.service.ts | 432 |
| 26 | lib/api/comfyui-api-service.ts | 398 |
| 27 | lib/api/comfyui-service.ts | 392 |
| 28 | lib/api/viewcomfy-api-services.ts | 388 |
| 29 | app/studio/mapping-editor/_components/parameter-mapping-panel.tsx | 384 |
| 30 | lib/local-storage-manager.ts | 375 |
| 31 | app/studio/playground/_components/Dialogs/TldrawShapes.tsx | 370 |
| 32 | components/visual-effects/GradualBlur.tsx | 346 |
| 33 | app/studio/playground/_components/Dialogs/TldrawEditorWidgets.tsx | 328 |
| 34 | components/visual-effects/ColorBends.tsx | 328 |
| 35 | app/studio/playground/_components/StyleCollageEditor.tsx | 314 |
| 36 | app/studio/settings/_components/ProviderFormModal.tsx | 314 |
| 37 | components/ui/dotted-glow-background.tsx | 308 |
| 38 | lib/store/api-config-store.ts | 293 |
| 39 | components/visual-effects/PixelCard.tsx | 290 |
| 40 | server/db/models.ts | 283 |
| 41 | lib/prompt/banner-prompt.ts | 263 |
| 42 | app/studio/dataset/_components/collection-detail/CollectionDetailListItem.tsx | 260 |
| 43 | lib/api/viewcomfy-integration.ts | 257 |
| 44 | app/studio/mapping-editor/_components/create-workflow-dialog.tsx | 252 |
| 45 | lib/store/playground-store.banner-actions.ts | 248 |
| 46 | app/globals.css | 246 |
| 47 | server/service/view-comfy.service.ts | 245 |
| 48 | app/studio/playground/_components/DescribePanel.tsx | 239 |
| 49 | server/service/history.service.ts | 236 |
| 50 | app/studio/tools/_components/ToolsView.tsx | 228 |

> 提示：建议将单文件控制在 100~300 行之间，超过阈值的文件优先评估拆分。
