# Playground 首页

## 背景

Playground 首页是 Studio 的默认落点（`/`、`/studio` 重定向到 `/studio/playground`）。首页以 Home 视图承载“快速开始”的输入与入口编排：生成输入区、Describe/Edit/History/Gallery 快捷入口，以及 Moodboard 跑马灯预览。

## 模块职责

- 作为 Studio 默认入口页，提供 Home 视图的核心 UI 编排与状态初始化。
- 承载主输入区与生成链路的入口（上传参考图、填写 prompt、触发生成）。
- 提供从 Home 视图快速切换到 Dock 视图（History/Gallery/Moodboards 等）的入口。
- 展示并引导进入 Moodboard（跑马灯与 “See All”）。

## 核心流程

### 路由入口

- `/studio/playground` 渲染 Playground 客户端页面并强制 `viewMode=home`。
- `/` 与 `/studio` 会重定向到 `/studio/playground`。

### Home 视图编排

- Home 主视觉与输入区：背景 + 输入区组件组合呈现。
- 快捷入口：Describe / Edit / History / Gallery 入口集中在 Home Actions。
- Moodboard 跑马灯：展示部分 moodboard 卡片，点击后切换到 Dock 的 moodboard 视图。

### 生成与保存

- 上传图片走 `/api/upload`，作为参考图/Describe 图的来源。
- 生成请求走 `/api/ai/image`。
- 生成结果与配置写入历史记录走 `/api/history`。

## 输入 / 输出

### 输入

- 路由：`/studio/playground`。
- 用户输入：prompt、参考图、模型/参数配置、快捷入口操作。
- 数据源：
  - 历史记录（SWR）：用于 History 面板与部分联动。
  - Moodboard Cards：用于首页跑马灯与 “See All” 入口。

### 输出

- UI：Home 视图、输入区、快捷入口、Moodboard 跑马灯。
- 状态变更：
  - 切换 `viewMode/activeTab` 以进入 Dock 面板。
  - 触发上传、生成、写入 history 等副作用。

## 依赖关系

### 前端依赖

- `usePlaygroundStore`：管理 viewMode/activeTab、生成配置、上传图、gallery/history 等状态与动作。
- `useHistory`（SWR）：分页拉取 history，用于 history panel 与部分联动。
- `usePlaygroundMoodboards`：拉取 moodboard cards，支持首页跑马灯与 Dock moodboard 视图。
- `useGenerationService`：封装生成与写入 history 的客户端链路。
- `useAuthStore/useAPIConfigStore`：用户 session 与默认模型/配置来源。

### 服务端依赖

- `/api/ai/image`、`/api/upload`、`/api/history`、`/api/moodboard-cards`、`/api/view-comfy`、`/api/presets`（以当前实现实际调用为准）。

## 状态 / 数据流

- 服务端数据（history 等）优先通过 SWR 管理；本地 UI/editor 状态通过 Zustand（Playground store）管理。
- 首页入口仅负责编排与切换，不维护独立持久化数据模型。

## 关键规则

- 浏览器侧请求保持同源 `/api/*`。
- 用户归属由服务端从 session 推导，客户端不得传入或信任 user id。
- 重型面板/弹窗应倾向懒加载以保证首页首屏性能（以现有实现为准）。

## 边界 / 非职责范围

- 不负责后端业务实现；后端遵循 `route handler -> service -> repository` 分层。
- 不负责独立的 History/Gallery/Moodboard 业务建模；首页只负责入口与编排。

## 修改影响范围

- 调整入口切换逻辑会影响 Dock 面板可达性与用户动线。
- 调整输入区与生成链路会影响上传、生成、history 写入等主流程。
- 调整首页首屏渲染/懒加载策略会影响性能与交互稳定性。

## 更新记录

- 2026-04-08：补充 Playground 首页模块文档，梳理入口、职责、依赖与边界。

