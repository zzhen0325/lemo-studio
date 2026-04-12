# Dataset

## 背景

Dataset 用于沉淀训练素材、风格素材与可复用图片资产，解决“生成结果如何进入长期资产库”与“素材如何被组织、标注、翻译与复用”的问题。它在 Studio 中是独立路由页面，并通过 SSE 同步机制在多端/多窗口间保持一致性。

## 模块职责

- 提供集合（collection）管理：创建、复制、导出、删除、重命名。
- 提供集合详情管理：图片列表/网格视图、排序、批量操作、删除、上传。
- 提供 prompt 双语字段编辑与自动保存（含失败回写与脏标记）。
- 提供 AI 工作流辅助（自动生成 prompt / 自动打标、翻译等，以当前实现为准）。
- 提供实时同步：写操作触发 SSE 事件，驱动前端刷新列表/详情。

## 核心流程

### 入口与页面结构

- 路由入口：`/studio/dataset`。
- `DatasetManagerView` 负责列表页与详情页的切换，并监听 SSE 同步信号。

### 集合与条目 CRUD

- 列表与详情读取统一走 `GET /api/dataset`（列表或带 `collection` 参数读取详情）。
- 创建/复制/上传走 `POST /api/dataset`。
- 更新 prompt/systemPrompt/order/rename 走 `PUT /api/dataset`。
- 删除集合或条目走 `DELETE /api/dataset`。

### 上传与解析

- 前端上传支持将 `.txt` 与图片配对，形成初始 prompt（以当前实现为准）。
- 后端上传写入 dataset entries 与 image assets，并维护集合内顺序。

### 实时同步（SSE）

- 写操作触发 dataset events，SSE 通过 `/api/dataset/sync` 推送 `sync/refresh`。
- 前端收到事件后刷新列表或详情；编辑中会暂缓刷新以避免覆盖本地改动（以当前实现为准）。

## 输入 / 输出

### 输入

- 集合信息（name、systemPrompt 等）。
- 图片与可选配套文本（prompt zh/en）。
- 批量操作参数（排序、删除、AI 工作流参数等）。

### 输出

- 集合与条目持久化数据（含顺序、prompt 双语字段、systemPrompt）。
- UI：列表页、详情页（网格/列表）、批量操作与状态提示。
- SSE 同步事件（驱动多处刷新）。

## 依赖关系

### 前端依赖

- Dataset 页面与组件：DatasetManagerView、CollectionList、CollectionDetail 及其子视图组件。
- 详情页服务层：collection-detail.service 等对 `/api/dataset` 的请求封装。
- AI 工作流：详情页的 prompt 自动生成 / 打标与翻译能力（调用现有 AI/translate 等接口，以当前实现为准）。
- EventSource：订阅 `/api/dataset/sync`。

### 服务端依赖

- `GET/POST/PUT/DELETE /api/dataset`：主 CRUD API。
- `GET /api/dataset/sync`：SSE 同步。
- `DatasetService/DatasetSyncService`：业务与同步实现。
- `DatasetRepository/ImageAssetsRepository`：持久化访问层。

## 状态 / 数据流

- 服务端数据（集合/条目）以请求结果为准，前端在详情页维护编辑态与自动保存队列。
- 写操作后：
  1. 服务端持久化写入（repository）
  2. 触发 dataset events
  3. SSE 推送 refresh 信号
  4. 前端按当前页面上下文刷新列表/详情

## 关键规则

- 参数校验与安全约束集中在 dataset schema（collection/filename 等），变更需同步评估安全边界。
- 图片 URL 需要做归一化与兼容处理（历史 URL/过期签名归一成 storage key，再生成展示 URL，以当前实现为准）。
- 写操作触发同步事件后，前端需谨慎处理“正在编辑时的刷新策略”，避免覆盖未保存内容。
- Dataset 的自动生成 prompt / 打标属于 `dataset_label` 流程，底层走 `/api/ai/describe` -> `service:datasetLabel`，不是 Playground prompt optimize。
- Dataset 翻译属于 `dataset_translate` 流程，底层走独立的 `/api/translate`，不复用 `/api/ai/text`。

## 边界 / 非职责范围

- Dataset 不负责 Playground 的生成与 history/gallery 展示；它面向长期资产沉淀与素材组织。
- Dataset 不负责通用对象存储管理，只消费既有 upload 与 URL 归一化能力。

## 修改影响范围

- 修改集合/条目模型字段会影响前端编辑、自动保存、导出与 SSE 刷新逻辑。
- 修改上传解析规则会影响 `.txt` 配对与 prompt 初始化结果。
- 修改 SSE 事件语义会影响多窗口一致性与刷新频率。

## 更新记录

- 2026-04-08：补充 Dataset 模块文档，梳理路由、API、SSE 同步与数据流边界。
- 2026-04-12：补充 Dataset AI 流程边界，明确自动生成 prompt / 打标与翻译都不属于 prompt optimization。
