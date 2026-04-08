# Moodboard

## 背景

Moodboard 用于把生成结果沉淀为可编排、可复用的风格/参考素材集合。在当前实现中，Moodboard 主要存在于 Playground 内（Home 跑马灯与 Dock 的 Moodboards 视图），并通过 `moodboard-cards` 系列接口进行持久化。

## 模块职责

- 展示 moodboard 列表与卡片（Home 跑马灯与 Dock 视图）。
- 提供 moodboard 的创建、编辑、排序、封面、发布/归档等管理动作。
- 提供从 Gallery/History 将生成结果加入 moodboard 的统一交互入口与写入逻辑。
- 提供 prompt 模板生成能力（服务端集成 Coze 等外部能力，以当前实现为准）。

## 核心流程

### 入口

- Home 底部 `MoodboardMarquee` 展示部分卡片，点击 “See All Moodboard” 切换到 `dock + style`。
- Dock 侧边栏 `Moodboards` Tab 对应 `activeTab=style`。

### 数据加载与缓存

- 客户端通过 `usePlaygroundMoodboards` 拉取 `GET /api/moodboard-cards?enabled=true`。
- 该 hook 内部维护模块级内存缓存、请求去重与订阅广播，用于跨组件同步刷新。

### 加入 Moodboard（统一动作）

- Gallery/History 的卡片动作统一通过 `AddToMoodboardMenu`：
  - 识别是否已有 shortcut 关联。
  - 需要时创建/更新 moodboard 卡并迁移旧关联。
  - 写入完成后刷新 moodboard 数据以同步 UI。

## 输入 / 输出

### 输入

- moodboard-cards 列表数据与单卡详情。
- 从 History/Gallery 传入的生成结果（图片 URL、prompt、元数据等）。

### 输出

- moodboard 卡片及其条目排序、封面、发布状态等持久化数据。
- UI：跑马灯、卡片网格/详情、加入菜单与管理入口。

## 依赖关系

### 前端依赖

- `usePlaygroundMoodboards`：Moodboard 主数据与刷新能力。
- `AddToMoodboardMenu` 与 `_lib/moodboard-card-gallery`：加入/创建/迁移逻辑。
- Playground 容器与 Dock：提供入口与视图承载。

### 服务端依赖

- `GET/POST /api/moodboard-cards`
- `GET/PATCH/DELETE /api/moodboard-cards/[id]`
- `POST /api/moodboard-cards/sort`、`/cover`、`/publish`、`/archive`
- `GET /api/moodboard-cards/code/[code]`：按 code 查重/定位
- `POST /api/moodboard-cards/prompt-template`：生成 prompt 模板（以当前实现为准）

## 状态 / 数据流

- Moodboard 数据由 `usePlaygroundMoodboards` 维护（内存缓存 + 订阅广播）。
- 加入/更新动作通过 `moodboard-cards` API 写入，完成后调用 refresh 刷新缓存并广播。

## 关键规则

- 用户归属由服务端从 session 推导，客户端不得传入或信任 user id。
- 加入 moodboard 的动作应保持幂等：重复加入同一条目应避免产生重复关系（以当前实现的 code/shortcut 机制为准）。
- 如果涉及迁移旧数据结构（如 style_stacks），需同步评估调用链上的删除/兼容逻辑。

## 边界 / 非职责范围

- Moodboard 不负责生成结果的生产，仅消费 History/Gallery 的结果并沉淀为集合资产。
- Moodboard 不负责对象存储读取策略设计，仅消费图片 URL/存储 key 与现有读取接口。

## 修改影响范围

- 修改 moodboard-cards API 契约会影响 Home 跑马灯、Dock 视图与 Add-to-Moodboard 菜单全链路。
- 修改缓存/广播策略会影响跨组件的一致性与刷新时机。
- 修改排序/封面/发布逻辑会影响对外展示与复用入口。

## 更新记录

- 2026-04-08：补充 Moodboard 模块文档，梳理入口、API、缓存策略与加入链路。

