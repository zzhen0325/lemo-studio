# Gallery（图库）

## 背景

Gallery 用于集中回看、筛选、复用生成结果与对应 Prompt，并提供把结果加入 Moodboard、再次生成、下载等常见动作。它既可以作为独立路由 `/studio/gallery` 使用，也会被 Playground 的 Dock 面板复用。

## 模块职责

- 提供生成结果的图墙浏览与虚拟化渲染（瀑布流、滚动加载）。
- 提供筛选与排序能力（搜索、模型、预设、Prompt 分类、recent/likes/favorites/downloads/edits）。
- 提供基于单条结果的快捷动作：Use Prompt、Use Image、Rerun、Download、加入 Moodboard。
- 提供 Prompt 列表视图（增量渲染，避免一次性渲染过多列表项）。

## 核心流程

### 入口与复用

- 独立页面：`/studio/gallery` 通过 `GalleryPageClient` 设置 `viewMode=dock`、`activeTab=gallery` 后复用 `GalleryView`。
- Playground 入口：Dock 面板动态加载并复用同一个 `GalleryView`。
- 旧路由：`/gallery` 重定向到 `/studio/gallery`。

### 拉取与分页

- 首次进入或条件变化时触发 `fetchGallery` 拉取第一页。
- 滚动触底时由图墙组件触发加载下一页。
- 预取：在合适时机调用 `prefetchGalleryNext` 提前拉取下一页以降低滚动等待。
- 增量同步：`syncGalleryLatest` 以节流策略定期拉取最新数据并合并进现有列表。

### 渲染与交互

- 图墙：`GalleryImageWall` 管理滚动容器、触底加载、加载态与结束态展示。
- 瀑布流：`VirtualizedGalleryMasonry` 负责虚拟化渲染、列布局与测高。
- 卡片：`GalleryImageCard` 提供动作入口并将事件回传到上层（Use Prompt / Use Image / Rerun / Download / 加入 Moodboard）。
- 滚动归属：Gallery 独立页与 Playground Dock 复用同一个内部滚动容器，滚动不依赖 `body/window`，外层 layout 只负责提供受限高度。

## 输入 / 输出

### 输入

- 路由入口：`/studio/gallery`（独立页面）或 Playground Dock（内嵌面板）。
- 查询条件（客户端本地状态）：搜索词、模型/预设筛选、Prompt 分类、排序方式。
- 数据源：`GET /api/history`（分页、排序、轻量字段）。

### 输出

- UI：图库瀑布流图墙、Prompt 列表、筛选与排序控件、动作菜单。
- 副作用：
  - 触发生成/复用（Use Prompt / Use Image / Rerun）会影响 Playground 的编辑态与生成流程。
  - 加入 Moodboard 会写入 moodboard-cards 相关数据。
  - 下载会发起浏览器下载行为。

## 依赖关系

### 前端依赖

- `usePlaygroundStore`：复用 Playground store 中的 gallery 状态与 actions（galleryItems、galleryPage、hasMoreGallery、fetchGallery/sync/prefetch 等）。
- `usePlaygroundMoodboards`：读取 moodboards/moodboardCards，并用于“加入 Moodboard”动作。
- `useGenerationService`：用于触发再次生成等生成侧动作。

### 服务端依赖

- `GET /api/history`：图库主数据来源，按 session 推导用户归属，支持排序与分页。
- `DELETE /api/history`：用于批量删除历史/图库项（Gallery 与 History 共用）。
- `app/api/storage/image`：统一图片访问入口，支持从对象存储拉取并输出给浏览器侧渲染。
- `moodboard-cards` 系列 API：用于把生成结果关联到 Moodboard（收藏与编排）。

## 状态 / 数据流

- Gallery 不维护独立 store：复用 `usePlaygroundStore` 的 gallery 字段与 action。
- Gallery 的服务端数据通过 `/api/history` 获取后进入 store，并进行分页拼接。
- 为避免持久化过大，store 只持久化裁剪后的 gallery 数据与分页状态（以当前实现为准）。

## 关键规则

- 用户归属必须由服务端从 session 推导，客户端不得传入或信任 user id。
- 图片 URL 统一通过 `resolveGalleryImageUrl` 解析为 `/api/storage/image` 访问路径，避免在 client code 中硬编码对象存储域名或跨端口后端地址。
- Prompt 分类与“哪些记录进入图墙”的规则集中在 `prompt-history`，调整图墙收录口径时优先修改这层规则并同步文档。
- `GalleryView -> GalleryImageWall` 的高度链必须保持连续的 `flex-1/min-h-0`，避免滚动容器退回自然高度后触发错误的 auto-fill/load-more。

## 边界 / 非职责范围

- Gallery 不负责底层生成任务编排与执行，仅触发或复用生成侧能力。
- Gallery 不负责定义新的持久化表或通用 CRUD；历史/图库数据由 `history` 体系承载（route handler -> service -> repository）。
- Gallery 不负责对象存储鉴权策略设计，只消费 `/api/storage/image` 暴露的读取能力。

## 修改影响范围

- 修改筛选/排序参数：同时影响 `/api/history` 的查询逻辑、`HistoryService` 的排序/字段裁剪，以及前端的分页合并策略。
- 修改卡片动作：可能影响生成流程、Moodboard 写入、下载行为与可观察埋点（如有）。
- 修改图墙虚拟化与布局：可能影响滚动性能、首屏渲染、触底加载触发时机与图片加载稳定性。

## 更新记录

- 2026-04-08：修正 Gallery 独立页与 Dock 共享视图的滚动归属，明确内部 scroll container 的高度约束规则。
- 2026-04-08：补充 Gallery 模块文档，梳理入口、数据来源、依赖关系与边界。
