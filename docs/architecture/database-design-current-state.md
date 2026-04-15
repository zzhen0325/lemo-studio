# CozeStudio 当前数据库设计总览（代码实况版）

## 1. 文档目的与范围

本文基于仓库当前代码（`app/api/*`、`lib/server/service/*`、`lib/server/repositories/*`、`lib/server/db/models.ts`、`supabase-schema.sql` 与 `scripts/*.sql`）整理数据库设计现状，重点覆盖：

- 数据源分层
- 接入原则与边界
- 核心抽象
- 关键数据结构（表结构 + JSON 字段）
- 反馈数据（点赞/下载/编辑/加到 moodboard）
- 当前 schema 漂移与风险

说明：本文是“当前实现快照”，与历史 wiki 或旧脚本冲突时，以代码行为为准。

---

## 2. 数据源分层（Current State）

### 2.1 分层视图

1. **L0: 客户端本地态（非持久化主源）**
- Zustand：编辑器/弹窗/拖拽等 UI 态。
- SWR：服务端数据缓存层（history/gallery/dataset 等）。
- localStorage：少量前端偏好与临时配置（非服务端真值）。

2. **L1: 同进程 API 层（Next.js `app/api/*`）**
- 唯一后端入口。
- 负责 session 解析、参数校验、HTTP 协议转换。

3. **L2: Service 层（业务规则）**
- 负责 owner 推导、DTO 转换、URL 归一化、迁移兼容。
- 关键服务：`HistoryService`、`DatasetService`、`InfiniteCanvasService`、`UsersService`、`PresetsService`、`StylesService`、`ToolsPresetsService`、`MoodboardCardsService`。

4. **L3: Repository + Model 持久化层**
- Repository：`lib/server/repositories/*`。
- Model：`lib/server/db/models.ts`（Supabase Query 封装，保留 Mongoose-like API）。
- 主持久化：Supabase 表。

5. **L4: 对象存储（二进制资产）**
- 经 `src/storage/object-storage.ts` + `lib/server/utils/cdn*.ts` 上传/签名。
- DB 存储 `storage_key`（或兼容旧 `url`），显示时再签名。

### 2.2 非主源/降级源

- `data/infinite-canvas/projects.json`：Infinite Canvas 在 Supabase 不可用时的降级存储。
- `data/api-config/providers.json`：API Provider 配置文件源（不是数据库）。
- `config/preset-catalog.json`、`config/style-catalog.json`：预设/风格冷启动导入源。

---

## 3. 接入原则与边界

### 3.1 主规则

- 前端统一同源调用 `/api/*`。
- 分层固定：`route handler -> service -> repository`。
- 新持久化逻辑应进入 `lib/server/repositories/`。
- 命名约定：
  - repository/DB 文档：`snake_case`
  - service/client DTO：`camelCase`
- 受保护数据归属由服务端会话推导（不信任客户端 user id）。

### 3.2 当前实现中的例外

以下是现存“绕 repository 直接查 Supabase”路径：

- `lib/server/service/interaction.service.ts`
  - 直接访问 `generations` / `generation_likes` / `style_stacks`。
- `app/api/admin/fix-urls/route.ts`
  - 维护脚本型管理路由，直接查改多表。
- `app/api/health/route.ts`
  - 直接做 `users` 连通性探测。

这些属于当前历史遗留或运维路径，不是推荐新增模式。

---

## 4. 核心抽象

### 4.1 Session Actor（归属模型）

`lib/server/auth/session.ts` 定义会话主体：

- `actorId`: 行为主体 ID（guest 为随机 UUID，登录后等于 userId）
- `userId`: 认证用户 ID（guest 为 null）
- `isGuest`: 是否游客

关键效果：

- History/Infinite Canvas 按 `actorId` 归属落库。
- 游客登录后，通过服务端迁移把历史与项目 owner 重指向真实用户。

### 4.2 Repository 抽象

每个业务域对应一个 repository，屏蔽表级细节：

- `HistoryRepository` -> `generations`
- `DatasetRepository` -> `dataset_collections`, `dataset_entries`
- `InfiniteCanvasRepository` -> `infinite_canvas_projects`
- `MoodboardCardsRepository` -> `moodboard_cards`
- `PresetsRepository` -> `presets`, `preset_categories`
- `StylesRepository` -> `style_stacks`
- `ToolPresetsRepository` -> `tool_presets`
- `ImageAssetsRepository` -> `image_assets`
- `UsersRepository` -> `users`

### 4.3 Model 适配层

`lib/server/db/models.ts` 提供统一能力：

- camelCase/snake_case 转换
- 兼容 `_id` -> `id`
- 链式查询（`find().sort().limit().lean()`）
- `updateOne/findOneAndUpdate/bulkWrite` 等接口兼容

### 4.4 资产 URL 规范化抽象

统一思路：

- DB 中尽量存储 `storage_key`（稳定）
- 展示时动态签名生成 URL
- 对历史 presigned URL/本地路径/data URL 做归一化并回写

相关模块：

- `lib/server/utils/cdn-image-url.ts`
- `lib/server/utils/cdn.ts`
- `src/storage/object-storage.ts`

---

## 5. 表级设计（按业务域）

## 5.1 `generations`（History/Gallery 主表）

**职责**
- 存储生成记录与生成配置快照。
- 承载交互统计聚合字段（like/download/edit/moodboard_add）。

**核心字段**
- 主键：`id`
- 归属：`user_id`, `project_id`
- 结果：`output_url`
- 配置：`config` (JSONB)
- 状态：`status`, `progress`, `progress_stage`
- 反馈聚合：
  - `like_count`, `moodboard_add_count`, `download_count`, `edit_count`
  - `last_liked_at`, `last_moodboard_added_at`, `last_downloaded_at`, `last_edited_at`

**`config` 里实际承载的关键业务结构**
- 生成参数：`prompt`, `model`, `baseModel`, `width`, `height`, `loras`, `seed`, `aspectRatio`, `imageSize`
- 编辑链路：`isEdit`, `parentId`, `editConfig`, `imageEditorSession`
- 多图输入：`sourceImageUrls`, `localSourceIds`
- Prompt 记录层语义：`historyRecordType`, `promptCategory`, `optimizationSource`

**主要读写入口**
- `GET/POST/DELETE /api/history`
- `GET /api/history?id=...` 或 `outputUrl=...`
- Service: `HistoryService`
- Repository: `HistoryRepository`

**排序能力（服务端）**
- `recent`, `likes`, `favorites`, `downloads`, `edits`, `interactionPriority`

---

## 5.2 `generation_likes`（点赞去重表）

**职责**
- 对 `(generation_id, user_id)` 去重，避免重复点赞。

**核心字段**
- `id`
- `generation_id`
- `user_id`
- 唯一约束：`UNIQUE(generation_id, user_id)`

**主要读写入口**
- `POST/GET /api/history/[id]/interactions`
- Service: `interaction.service`（直接 Supabase）

---

## 5.3 `image_assets`（图片资产索引表）

**职责**
- 记录对象存储中的文件索引与元信息。

**核心字段（代码实况）**
- `id`
- `storage_key`（优先）
- `url`（兼容旧逻辑，可能是 presigned 或历史值）
- `dir`, `file_name`, `region`, `type`
- `meta`（例如 presetId / collection 等）

**主要写入来源**
- `UploadService`（`/api/upload`）
- `SaveImageService`（`/api/save-image`）
- `DatasetService`（上传 dataset 图片）

---

## 5.4 `dataset_collections` + `dataset_entries`（Dataset）

### `dataset_collections`

**职责**
- 集合元数据（集合名、系统 prompt、排序）。

**关键字段（代码实况）**
- `id`, `name`
- `system_prompt`（服务层对外 `systemPrompt`）
- `order_arr`（服务层对外 `order`）
- `count`（存在但核心计数通常实时算）

### `dataset_entries`

**职责**
- 集合内图片条目与双语 prompt。

**关键字段（代码实况）**
- `id`, `collection_name`, `file_name`, `url`
- `prompt`（兼容主字段）
- `prompt_zh`, `prompt_en`
- `order_idx`
- `width`, `height`, `format`, `size`, `metadata`

**主要入口**
- `GET/POST/PUT/DELETE /api/dataset`
- SSE: `GET /api/dataset/sync`
- Service: `DatasetService`, `DatasetSyncService`

**同步机制**
- 写操作触发 `datasetEvents.emit('sync')`
- SSE 向客户端推送 `event: sync, data: refresh`

---

## 5.5 `infinite_canvas_projects`（Infinite Canvas 项目总表）

**职责**
- 一条记录承载一个项目完整状态（JSON 结构化）。

**核心字段**
- 识别：`id`, `project_id`
- 归属：`user_id`
- 元数据：`project_name`, `cover_url`, `node_count`, `last_opened_panel`
- 画布：`canvas_viewport`
- 图结构：`nodes`, `edges`
- 资产与运行态：`assets`, `history`, `run_queue`

**主要入口**
- `GET/POST /api/infinite-canvas/projects`
- `GET/PUT/PATCH/DELETE /api/infinite-canvas/projects/[projectId]`
- `POST /api/infinite-canvas/projects/[projectId]/duplicate`

**关键特性**
- Supabase 主存储不可用时自动降级 `data/infinite-canvas/projects.json`。
- 首次可从 legacy JSON 自动迁移入 Supabase。

---

## 5.6 `moodboard_cards`（Moodboard 卡片）

**职责**
- 管理可发布的 moodboard 卡片、封面、模板与图集顺序。

**核心字段**
- `id`, `code`, `name`, `sort_order`, `is_enabled`
- 封面：`cover_storage_key`, `cover_url`, `cover_title`, `cover_subtitle`
- 模型默认：`model_id`, `default_aspect_ratio`, `default_width`, `default_height`
- 模板：`prompt_template`, `prompt_fields`, `prompt_config`
- 内容：`moodboard_description`, `example_prompts`, `gallery_order`
- 发布态：`publish_status`, `published_at`

**主要入口**
- `/api/moodboard-cards` 及其子路由（`[id]`, `cover`, `publish`, `archive`, `sort`, `code/[code]`）

---

## 5.7 `presets` + `preset_categories`

### `presets`
- 存储文生图/编辑预设。
- 关键字段：`name`, `cover_url`, `config`, `edit_config`, `category`, `type`, `project_id`。

### `preset_categories`
- 保存预设分类列表（默认 key=`default`）。
- 字段：`key`, `categories`。

**主要入口**
- `/api/presets`
- `/api/presets/categories`

---

## 5.8 `style_stacks`

**职责**
- 历史风格堆栈数据（当前仍有读写，但部分能力向 moodboard_cards 迁移过）。

**关键字段**
- `id`, `name`, `prompt`
- `image_paths`, `preview_urls`
- `collage_image_url`, `collage_config`

**主要入口**
- `/api/styles`
- Service: `StylesService`

---

## 5.9 `tool_presets`

**职责**
- Tools 模块每个 tool 的参数预设。

**关键字段**
- `id`, `tool_id`, `name`, `values`, `thumbnail`, `timestamp`

**主要入口**
- `/api/tools/presets`

---

## 5.10 `users`

**职责**
- 用户基本信息与登录凭据（当前实现含密码字段逻辑）。

**关键字段（代码实况）**
- `id`, `display_name`, `avatar_url`, `password`, `created_at`

**主要入口**
- `/api/users`（GET 当前会话用户、POST register/login、PUT 更新 profile、DELETE 退出成 guest）

---

## 6. 反馈数据设计（Interaction Data）

## 6.1 行为类型

统一 action：

- `like`
- `moodboard_add`
- `download`
- `edit`

API：`POST /api/history/[id]/interactions`

## 6.2 存储策略

- 点赞去重：`generation_likes` 唯一键。
- 统计聚合：写回 `generations` 计数 + 最后行为时间。
- 查询返回：
  - `interactionStats`（计数与最后时间）
  - `viewerState.hasLiked`

## 6.3 幂等与兼容

- `like`：先查 `generation_likes`，已点赞则幂等返回。
- `like_count` 更新优先尝试 RPC `increment_like_count`，失败后走普通 update 回退。
- `moodboard_add`：尝试按 `(generation_id, moodboard_id)` 去重（当前依赖 `style_stacks` 查询，见风险章节）。

---

## 7. 模块级数据流（简版）

## 7.1 Playground History/Gallery

1. 前端生成后先 optimistic 叠加本地 History。
2. `POST /api/history` 落 `generations`。
3. `GET /api/history` 分页拉取（支持 lightweight/minimal）。
4. Gallery/History 共享同一源。

## 7.2 Dataset

1. 上传图片 -> 对象存储。
2. 写 `image_assets` + `dataset_entries`。
3. 集合元信息写 `dataset_collections`。
4. 写后触发 SSE `sync` 刷新前端。

## 7.3 Infinite Canvas

1. 项目读写 `infinite_canvas_projects`。
2. owner 缺失时首访 claim。
3. Supabase 不可用时降级 JSON 文件。

## 7.4 Moodboard

1. 卡片元信息写 `moodboard_cards`。
2. 封面写对象存储并回填 `cover_storage_key/cover_url`。
3. 发布态通过 `publish_status` 管理。

---

## 8. 安全与归属模型

## 8.1 应用层 owner 控制

- History / Infinite Canvas：通过 session `actorId` 控制归属。
- 登录迁移：guest 数据迁移到真实 userId。

## 8.2 访问作用域矩阵（按当前 API 行为）

- **按 session actor 隔离**：`/api/history`（私有模式）、`/api/infinite-canvas/projects*`、`/api/users`（认证写入）。
- **公共共享数据**：`/api/dataset*`、`/api/presets*`、`/api/styles`、`/api/tools/presets`、`/api/moodboard-cards*`。
- **运维/诊断路径**：`/api/admin/fix-urls`、`/api/health`、`/api/migrate-storage-keys`（不属于常规业务 CRUD）。

## 8.3 表级 RLS 现状

`supabase-schema.sql` 当前默认策略是对所有核心表 `USING (true)` 的匿名全开放策略（开发友好，生产需收紧）。

结论：当前主要依赖应用层约束，而不是严格依赖 DB 层 RLS。

---

## 9. 已识别 schema 漂移与风险（重点）

以下为“代码依赖字段”与 `supabase-schema.sql` 的差异：

1. `image_assets`
- 代码使用 `storage_key`。
- 基础 schema 未定义该列（脚本/代码存在不一致）。

2. `dataset_entries`
- 代码使用 `prompt_zh`, `prompt_en`, `order_idx`。
- 基础 schema 未定义这些列。

3. `dataset_collections`
- 代码使用 `system_prompt`, `order_arr`。
- 基础 schema 未定义这些列。

4. `users`
- 代码使用 `password`（register/login）。
- 基础 schema 未定义该列。

5. `interaction.service` 的 moodboard 去重逻辑
- 代码查询 `style_stacks.generation_id/moodboard_id`。
- 当前 `style_stacks` 结构未体现这两个字段，存在逻辑漂移风险。

6. `increment_like_count` RPC
- 代码会调用该 RPC，但不在基础 schema 脚本内。
- 已有回退逻辑，不会完全阻塞，但会影响一致性与并发性能。

7. `HistoryService.saveHistory` 的遗留动作
- `sync-image` 在 Supabase 路径仅保留占位日志，未完整实现。
- `migrate-user-history` 在该入口返回空迁移结果，真实迁移由 `/api/users` 登录流程触发。

8. lightweight/minimal 查询目前字段投影相同
- `getHistory` 中 lightweight/minimal 与非 lightweight 使用了相同 `select` 字段串。
- 轻量模式当前主要差异来自“跳过重 URL 归一化与批量互动状态查询”。

---

## 10. 迁移与演进资产

主要迁移脚本：

- `scripts/migrate-infinite-canvas-projects-v2.sql`
  - 把旧 `infinite_canvas_projects` 结构迁到展开列模型。
- `scripts/rename-playground-shortcuts-to-moodboard-cards.sql`
  - 旧表重命名与索引/约束清理。
- `scripts/fix-expired-urls.sql`
  - 把过期 presigned URL 回写为稳定 storage key。
- `scripts/migrate-styles-to-shortcuts.mjs`
  - 历史 `style_stacks` 向 `playground_shortcuts/moodboard_cards` 迁移。

---

## 11. 建议（落地优先级）

1. **先补齐 schema 基线**
- 基于当前代码生成一版“可直接建库”的 SQL（含 `storage_key`、`prompt_zh/prompt_en/order_idx`、`system_prompt/order_arr`、`users.password` 等）。

2. **补齐 interaction 去重实体**
- 明确 `moodboard_add` 去重应依赖哪张关系表，不再借 `style_stacks` 隐式承载。

3. **把 direct Supabase 访问逐步回收进 repository**
- 优先处理 `interaction.service`，减少跨层漂移。

4. **收紧生产 RLS**
- 从 “Allow anonymous access” 过渡到按 owner/policy 的最小权限。

5. **SSE 跨实例一致性方案**
- Dataset Sync 当前为进程内 `EventEmitter`；多实例部署时需切到外部事件总线。

---

## 12. 一句话总结

当前 CozeStudio 的数据库设计是“Supabase 关系表 + JSONB 业务快照 + 对象存储 key 索引 + 部分本地 JSON 降级源”的混合体系；分层规则已基本明确，但 schema 基线与代码字段存在多处漂移，下一步应优先做 schema 对齐与反馈链路规范化。
