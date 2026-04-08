# Describe

## 背景

Describe 用于把用户上传的图片转成可复用的文本描述（prompt），以便快速进入生成流程。Describe 入口位于 Playground 内，通过切换到 `activeTab=describe` 展示描述面板。

## 模块职责

- 提供图片上传与预览能力（Describe 图）。
- 调用 `/api/ai/describe` 生成多组描述结果（按不同 focus prompt）。
- 把描述结果以 history 记录形式沉淀，支持一键 “Use Prompt” 回填到生成输入。

## 核心流程

### 入口

- 首页快捷入口与 Dock 侧边栏入口都可进入 Describe。
- 进入 Describe 后在输入区渲染 `DescribePanel`。

### 上传与描述

- 用户上传图片后存入 `describeImages`。
- 发起描述时取首张图片（base64）并并行请求多组描述。
- 描述接口返回 `{ text }`，前端汇总为可选择/可复用的 prompt。

### 结果沉淀与复用

- Describe 结果会作为 `image_description` 类型写入 history。
- 在 History/Gallery 中选择 “Use Prompt” 时，会把 `result.config.prompt` 回填到当前配置的 `config.prompt`。
- 批量使用时可逐条把描述 prompt 作为新的生成任务输入。

## 输入 / 输出

### 输入

- Describe 图片（用户上传）。
- 可选参数：model、prompt/context/options（由当前实现与 schema 决定）。

### 输出

- 描述文本（prompt）。
- history 记录（用于复用与追溯）。

## 依赖关系

### 前端依赖

- Playground 容器负责 Tab 切换、上传路由与请求触发。
- Describe 面板负责 UI 与动作触发。

### 服务端依赖

- `POST /api/ai/describe`：描述图片生成文本。
- `POST /api/history`：保存 describe 结果到历史记录。
- `POST /api/upload`：上传图片（用于持久化与后续引用）。

## 状态 / 数据流

- Describe 的 UI 状态与上传图片存放在 Playground store（与其它输入态同源管理）。
- Describe 的历史沉淀通过 `/api/history`，随后由 `useHistory`（SWR）拉取并展示。

## 关键规则

- 描述与生成复用同一套“历史沉淀”机制：Describe 输出必须可追溯、可复用。
- 用户归属由服务端从 session 推导，客户端不得传入或信任 user id。
- 复用 Describe prompt 进入生成前，需避免把 `image_description` 的元数据污染普通生成（以现有实现的清理逻辑为准）。

## 边界 / 非职责范围

- Describe 不负责图像生成，仅负责把图片转成文本描述与沉淀。
- Describe 不定义新的图库/历史数据结构，沉淀走既有 history 体系。

## 修改影响范围

- 修改请求体/返回体会影响 `/api/ai/describe` 的 schema、服务端 provider 适配以及前端并行结果汇总。
- 修改结果写入策略会影响 History/Gallery 的分类、筛选与复用路径。

## 更新记录

- 2026-04-08：补充 Describe 模块文档，梳理入口、调用链与数据流。

