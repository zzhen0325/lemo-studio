# Gallery（图库）

## 背景

Gallery 用于集中回看、筛选、复用生成结果与对应 Prompt，并提供把结果加入 Moodboard、再次生成、下载等常见动作。它既可以作为独立路由 `/studio/gallery` 使用，也会被 Playground 的 Dock 面板复用。

## 模块职责

- 提供生成结果的图墙浏览与虚拟化渲染（瀑布流、滚动加载）。
- 提供筛选与排序能力（搜索、模型、预设、Prompt 分类、recent/likes/favorites/downloads/edits）。
- 提供基于单条结果的快捷动作：Use Prompt、Use Image、Rerun、Download、加入 Moodboard。
- 提供 Prompt 列表视图（虚拟化网格，避免一次性渲染过多列表项）。

## 核心流程

### 入口与复用

- 共享模块：`components/gallery/*` 提供 `GalleryScene`、Toolbar、FilterPanel、MasonryWall、PromptGrid、ImageCard。
- 独立页面：`/studio/gallery` 通过 `GalleryPageClient` 直接渲染 `GalleryView mode="standalone"`，不再在挂载时写 Playground 的 `viewMode/activeTab`。
- Playground 入口：Dock 面板复用同一个 `GalleryView`，仅通过薄适配层注入动作与生成能力。
- 旧路由：`/gallery` 重定向到 `/studio/gallery`。
- SSR 边界：独立页与 Playground Dock 都通过 client-only 动态加载 `GalleryView`，避免 `masonic` / `react-virtualized-auto-sizer` 在预渲染阶段触发 `ResizeObserver`。

### 拉取与分页

- `useGalleryFeed({ sortBy })` 基于 `useSWRInfinite` 拉取 `/api/history` 轻量分页数据。
- 首屏加载第一页，滚动接近尾部时由图墙组件触发 `loadMore()` 拉下一页。
- `revalidateLatest()` 会节流拉取第一页并把最新结果 prepend 到当前缓存。
- Dock 与独立页通过同一套 SWR key 共享缓存，不再在 Zustand 中维护一份长期镜像。

### 渲染与交互

- 图墙：`GalleryMasonryWall` 管理内部滚动容器、触底加载、加载态与结束态展示。
- 瀑布流：`masonic` 负责列布局、测高与虚拟化，Gallery 只保留 scroll viewport 和 load-more 的控制层。
- Prompt 视图：`GalleryPromptGrid` 基于 `react-window` + `react-virtualized-auto-sizer` 渲染虚拟化网格。
- 卡片：`GalleryImageCard` 接收统一的 view model 和 action handlers，下载统一使用解析后的 download URL。
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

- `useGalleryFeed`：Gallery 服务端数据唯一入口，负责分页、去重、最新页同步与 filter option 聚合。
- `lib/gallery/resolve-gallery-item`：统一把 `/api/history` 记录转换为展示层 view model（display URL、download URL、thumbnail、prompt category、图墙可见性）。
- `usePlaygroundStore`：只保留本地编辑动作桥接（applyPrompt、applyImage、setViewMode、setActiveTab 等），不再保存 gallery feed。
- `usePlaygroundMoodboards`：读取 moodboards/moodboardCards，并用于“加入 Moodboard”动作。
- `useGenerationService`：用于触发再次生成等生成侧动作。

### 服务端依赖

- `GET /api/history`：图库主数据来源，按 session 推导用户归属，支持排序与分页。
- `DELETE /api/history`：用于批量删除历史/图库项（Gallery 与 History 共用）。
- `app/api/storage/image`：统一图片访问入口，支持从对象存储拉取并输出给浏览器侧渲染。
- `moodboard-cards` 系列 API：用于把生成结果关联到 Moodboard（收藏与编排）。

## 状态 / 数据流

- Gallery 的服务端数据完全由 `useGalleryFeed` 通过 SWR 管理。
- Zustand 只承担 Playground 本地 UI / editor state；Gallery feed 不再进入 store，也不再参与持久化。
- 视图层以 `GalleryItemViewModel` 为唯一输入，统一处理展示 URL、下载 URL、thumbnail、Prompt 分类和图墙收录规则。

## 关键规则

- 用户归属必须由服务端从 session 推导，客户端不得传入或信任 user id。
- 图片 URL 统一通过 `resolveGalleryImageUrl` 解析为 `/api/storage/image` 访问路径，避免在 client code 中硬编码对象存储域名或跨端口后端地址。
- Prompt 分类与“哪些记录进入图墙”的规则集中在 `prompt-history`，调整图墙收录口径时优先修改这层规则并同步文档。
- `GalleryView -> GalleryScene -> GalleryMasonryWall` 的高度链必须保持连续的 `flex-1/min-h-0`，避免滚动容器退回自然高度后触发错误的 auto-fill/load-more。
- Prompt / Image 两个 tab 必须共用同一套 filter state、sort state 和 feed cache，避免切 tab 时重复拉取或丢失筛选上下文。

## 边界 / 非职责范围

- Gallery 不负责底层生成任务编排与执行，仅触发或复用生成侧能力。
- Gallery 不负责定义新的持久化表或通用 CRUD；历史/图库数据由 `history` 体系承载（route handler -> service -> repository）。
- Gallery 不负责对象存储鉴权策略设计，只消费 `/api/storage/image` 暴露的读取能力。

## 修改影响范围

- 修改筛选/排序参数：同时影响 `/api/history` 的查询逻辑、`HistoryService` 的排序/字段裁剪，以及 `useGalleryFeed` 的 SWR key 和分页合并策略。
- 修改卡片动作：可能影响生成流程、Moodboard 写入、下载行为与可观察埋点（如有）。
- 修改图墙虚拟化与布局：可能影响 `masonic` 的 render range、滚动性能、首屏渲染、触底加载触发时机与图片加载稳定性。

## 更新记录

- 2026-04-08：独立路由 `GalleryPageClient` 改为与 Playground Dock 一致的 client-only 动态加载，修复 `ResizeObserver is not defined` 导致的 `/studio/gallery` 构建失败。
- 2026-04-08：Gallery feed 从 Playground Zustand 迁移到 `useSWRInfinite`，删除旧的 gallery 分页、prefetch 和持久化状态。
- 2026-04-08：图墙虚拟化改为 `masonic`，Prompt tab 改为 `react-window`，独立页不再在挂载时改写 Playground tab/view mode。
- 2026-04-08：修正 Gallery 独立页与 Dock 共享视图的滚动归属，明确内部 scroll container 的高度约束规则。
- 2026-04-08：补充 Gallery 模块文档，梳理入口、数据来源、依赖关系与边界。
