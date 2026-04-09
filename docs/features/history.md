# History

## 背景

History 用于回看与复用 Playground 的历史输入与输出，包括生成结果、Describe 文本等。History 当前不是独立路由页面，而是 Playground Dock 里的一个 Tab 面板；同时它与 Gallery 共用同一套后端 `history` 数据源。

## 模块职责

- 在 Playground 内提供历史记录的分组展示、无限滚动分页加载与筛选/布局切换。
- 提供单条/批量动作：Rerun、Use Prompt/Use All、Describe 分组的 Generate ALL、Edit、Download、Add to Moodboard、批量删除。
- 将用户交互（like/download/edit/moodboard_add 等）写入交互统计接口（如有接入）。

## 核心流程

### 入口

- Home 视图的 History 快捷入口会切换到 `viewMode=dock` 且 `activeTab=history`。
- Dock 侧边栏提供 History Tab 切换。

### 拉取与分页（SWR）

- `useHistory` 使用 `useSWRInfinite` 分页拉取历史列表（默认 limit=50）。
- 触底加载下一页，`hasMore` 控制是否继续。
- 服务端 SWR 只承载已持久化的 history 真值；本地生成中的 optimistic 记录通过 Playground store 的 overlay 叠加到 History 面板，不再直接写回 SWR page。
- 生成完成但尚未被服务端 feed 接管的记录会显示 `Syncing...`，持久化失败会显示 `Save failed`，避免记录“出现后消失”。

### 删除与交互

- 批量删除：进入选择模式，选择多条后请求 `DELETE /api/history`，并同步更新前端列表状态。
- 交互统计：通过 `/api/history/[id]/interactions` 记录 like/download/edit/moodboard_add 等。

## 输入 / 输出

### 输入

- 数据源：`GET /api/history?page&limit...`。
- 用户动作：选择/删除、复用 prompt、再次生成、编辑、下载、加入 moodboard 等。

### 输出

- UI：历史分组列表与卡片。
- 副作用：
  - 触发生成、编辑弹窗、下载、moodboard 写入。
  - 删除会影响 Gallery（共用数据源）与相关引用（以调用方实现为准）。

## 依赖关系

### 前端依赖

- `useHistory`（SWR）：History 主数据来源。
- Playground 容器：承接 Tab 切换与动作回调（Use Prompt / Rerun / Edit 等）。
- `usePlaygroundMoodboards`：Add-to-Moodboard 动作依赖其数据与刷新能力。

### 服务端依赖

- `GET/POST/DELETE /api/history`：读写与批量删除。
- `POST/GET /api/history/[id]/interactions`：交互统计读写（如当前 UI 接入）。

## 状态 / 数据流

- History 列表展示数据 = `optimistic overlay + SWR history`，按记录 id 去重并优先展示服务端真值。
- Zustand 仅保存本地 overlay 与 UI 状态；SWR 只保存服务端 history 真值。
- 生成、Describe、Prompt Optimization 等本地记录先进入 overlay，再异步写入 `/api/history`；服务端记录出现后会自然覆盖本地 overlay 版本。

## 关键规则

- History 与 Gallery 共用同一后端数据源：修改 history 查询/写入/删除语义需同时评估两个视图的影响。
- 用户归属由服务端从 session 推导；删除与更新必须按 owner 限制范围。
- 读取历史记录时如需规范化输出图/参考图 URL，只能补丁式更新 URL 相关字段，不能覆盖已有 `config` 元数据（如 prompt、model、workflow/edit 标记）。
- `Use All`、`Use Model`、`Rerun` 现在统一走 Playground 容器的参数回填入口，避免卡片内部各自拼装配置造成 workflow、preset、reference image、edit 状态不一致。
- workflow 历史记录回填时必须保持 `config.model = Workflow`、`config.baseModel = 原底模` 的组合；否则 UI 虽然显示选中了 workflow，再次生成仍可能误走普通文生图链路。

## 边界 / 非职责范围

- History 不负责独立路由与 SEO 展示（当前仅作为 Playground 面板）。
- History 不负责定义生成任务或 provider 适配，只负责回看与触发复用动作。

## 修改影响范围

- 修改分页与分组逻辑会影响滚动性能与数据一致性。
- 修改删除或交互统计会影响 likes/downloads/edits 等排序与统计展示（如 Gallery 接入）。
- 修改卡片动作会影响生成链路、编辑链路与 moodboard 写入。

## 更新记录

- 2026-04-09：`Use All` / `Rerun` 回填的存储参考图在发送给 `coze_seed4` 前会优先由服务端转成内联 `data:` 图片，避免 gallery/history 里的签名存储 URL 或同源 `/api/storage/image` 被上游判成不支持格式。
- 2026-04-09：History 面板改为 `optimistic overlay + SWR truth` 双层合成；生成中与保存失败态不再直接写入 SWR page，并新增 `Syncing...` / `Save failed` 可见状态。
- 2026-04-09：`Use All` / `Use Model` / `Rerun` 的参数回填统一收口到页面级 handler，修正 workflow 记录与 prompt optimization 记录回填不一致的问题。
- 2026-04-08：补充 History 模块文档，梳理入口、SWR 数据流、API 依赖与边界。
- 2026-04-08：补充历史记录 URL 规范化的配置保留规则，并明确 Describe 分组批量动作文案为 `Generate ALL`。
