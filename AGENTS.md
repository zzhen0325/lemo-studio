# CozeStudio Agent Guide

本文件面向 Codex、Cursor、Claude 等代码代理，帮助代理在进入仓库后快速理解项目定位、运行方式、架构边界和提交流程。

## 项目定位

- 本项目对应 LEMO Studio / Lemon8 AI Studio / Crate，同一套 AI 图像创作工作台能力。
- 技术形态是 Next.js 15 单体应用：前端页面与 `app/api/*` 路由运行在同一个 Next.js Node 进程中。
- 核心模块包括 `Playground`、`Infinite Canvas`、`Dataset`、`Mapping Editor`、`Gallery`、`Tools`、`Settings`。
- 外部依赖通过环境变量接入，主要包括 Supabase、对象存储/CDN、ComfyUI、ViewComfy，以及多种 AI Provider。
- 当前的产品重点不是“单次出图”，而是让 Prompt、参考图、工作流、结果和项目编排形成可复用的创作系统。

## 快速运行

仓库当前统一推荐使用 `pnpm`。如果旧文档里出现 `npm`，优先以 `package.json` 中现有脚本为准。

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

- 默认本地端口是 `3001`，`scripts/dev-frontend.sh` 会把 `NEXT_PUBLIC_APP_PORT` 同步到这个端口。
- 本地开发默认地址是 `http://127.0.0.1:3001`。
- 浏览器侧 API 默认走同源 `/api/*`，不要把前端请求改成跨端口后端地址。
- 健康检查路径是 `/healthz`。
- Playwright 默认也会起一个本地 Next dev server；如需复用外部服务，使用 `PLAYWRIGHT_BASE_URL`。
- 大改动或准备提交前，可按需运行 `pnpm ci:check`。

## 业务背景速览

### Playground

主创作工作台。负责 Prompt、参考图、模型参数、生成任务发起、历史回看和再次生成，是最核心的交互入口。

### Mapping Editor

把 ComfyUI 等底层工作流抽象成业务可操作的表单和映射规则。它存在的意义是降低复杂工作流的复用门槛，而不是替代底层节点编排。

### Dataset

沉淀训练素材、风格素材和可复用图片资产，承接“生成结果如何进入长期资产库”的问题。

### Infinite Canvas

把单次生成升级为项目化编排。节点、边、参考图和生成结果在这里形成更长链路的创作上下文。

### Gallery / History / Tools / Settings

- `Gallery` / `History` 负责回看、筛选、复用与追溯。
- `Tools` 提供独立图像工具和实时效果能力。
- `Settings` 管理 Provider、模型和默认策略。

理解这些模块的关系很重要：这个产品的核心不是单张图片，而是创作上下文的复用、沉淀和重新编排。

## 架构与目录边界

### 目录约定

- `app/`: Next.js App Router 页面与路由。
- `app/api/`: 唯一业务 API 实现位置。
- `app/studio/*/_components`: route-private 组件，优先放只服务当前业务路由的 UI。
- `components/`: 跨路由复用组件与 UI primitives。
- `lib/`: 共享业务逻辑、适配器、store、工具。
- `lib/server/`: 服务层、仓储层、服务端运行时工具。
- `lib/server/repositories/`: 新持久化代码唯一允许进入的目录。
- `scripts/`: 维护脚本、检查脚本和迁移脚本。
- `docs/`: 工程与产品文档。
- `tests/` 与 `e2e/`: 单测和端到端测试。
- `workflows/`: 工作流模板和配置。

### API 与分层规则

- 前端必须使用同源 `/api/*`，不要在 client code 中硬编码跨端口 backend URL。
- `app/api/*` route handler 是唯一后端入口，handler 只负责协议层与参数转发。
- 推荐分层固定为 `route handler -> service -> repository`。
- handler 和 service 不要直接操作 Supabase 表形态数据或自行拼接通用持久化逻辑。
- 新存储访问应通过 repository 方法封装，不要暴露通用 `updateOne/deleteOne/findOneAndUpdate` 风格接口。
- 受保护数据的用户归属必须由服务端推导，不能信任客户端传入的 user id。

### 命名与 DTO 规则

- repository 输入和存储文档使用 `snake_case`。
- service 与 client DTO 使用 `camelCase`。
- 同一个跨层对象不要同时携带一组 `snake_case` 和 `camelCase` 别名。

### Playground 数据流规则

- SWR 管理服务端数据，如 history、gallery、presets、categories、styles。
- Zustand 只保存本地 UI / editor 状态，如输入配置、弹窗、拖拽、选择、临时编辑态。
- 持久化数据要通过 SWR `mutate` 回流，不要在本地 store 里维护一套长期镜像。
- 重型 Playground dialog / editor 应优先通过 `next/dynamic` 懒加载。

### AI Provider 规则

- `lib/ai/providers.ts` 只做薄导出层，不要把复杂逻辑塞进去。
- Provider 运行时配置加载放在懒加载路径，避免 import-time file IO 和嘈杂日志。
- 新 provider family 放到 `lib/ai/providers/` 目录体系。

### Infinite Canvas 边界

- Project CRUD 放在 `app/infinite-canvas/_lib/project-api.ts`。
- 生成与图片下沉逻辑放在 `app/infinite-canvas/_lib/generation-api.ts`。
- 项目持久化状态不要和 viewport、selection、dialog UI state 混在一起。

### 文件体积阈值

- 默认文件阈值是 500 行。
- `PlaygroundPageContainer.tsx` 和 `InfiniteCanvasEditor.tsx` 当前是临时热点，允许到 1200 行。
- provider 入口文件上限 600 行。
- repository 文件上限 400 行。
- 文件已经超过阈值时，先拆分职责，再继续加行为。

## 改动守则与禁区

- 不要在仓库根目录放临时脚本、测试草稿、生成截图或一次性说明文件。
- 不要提交 `.next/`、`report/`、运行时日志或其他生成产物。
- 不要让 client code 依赖 `GULUX_API_BASE` 或 `INTERNAL_API_BASE`，这些路径已退役。
- 公共环境变量读取集中到 `lib/env/public.ts`。
- 新的持久化逻辑不要绕过 repository 直接打表。
- 不要重新引入 `ModelType`、`Injectable`、`Inject`、`connectMongo` 或伪 DI 体系。
- 不要在 import 时执行昂贵初始化、文件读取或 noisy logging。
- 如果已有目录和文档已经定义了归属，就沿用现有结构，不要为同类能力另开一套新约定。

## 已有资料与技能入口

优先阅读以下文档，再决定实现方式：

- `README.md`: 最基础的启动方式与测试入口。
- `docs/PROJECT_STRUCTURE.md`: 目录与根目录清理规则。
- `docs/ENVIRONMENT.md`: 环境变量契约。
- `docs/DEPLOYMENT.md`: 部署模型、启动命令与健康检查。
- `docs/architecture/second-round-refactor.md`: 当前最重要的分层与重构约束。
- `docs/product-philosophy-and-technical-plan.md`: 产品主线、模块关系与领域术语。
- `docs/features/prompt-ai-flows.md`: Prompt 相关 AI 流程总览与边界说明。
- `docs/testing/ui-interaction-test-plan.md`: 当前前端交互专项测试口径。
- `docs/features/gallery.md`: Gallery 模块文档（职责、边界、数据流与接口）。
- `docs/wiki/README.md`: 旧版技术 wiki，仅作历史背景参考，不应覆盖当前根目录文档和现行代码结构。

仓库还自带一些代理技能，位于 `.agent/skills/`，包括但不限于：

- `frontend-design`
- `canvas-design`
- `webapp-testing`
- `web-design-guidelines`
- `vercel-react-best-practices`
- `tldraw-annotate`

如果任务与这些能力强相关，优先复用已有 skill，而不是重新发明流程。

## 文档协作与索引

本项目使用 `docs/` 目录沉淀模块级技术逻辑、职责边界、依赖关系与更新记录。文档属于变更的一部分，不是可选项。

### 模块文档索引

- `docs/features/playground-home.md`: Playground 首页（入口编排与切换）。
- `docs/features/prompt-ai-flows.md`: Prompt 相关 AI 流程总览（执行层 / 业务层 / 记录层）。
- `docs/features/describe.md`: Describe（图片转 prompt）。
- `docs/features/edit.md`: Edit（图片编辑与再次生成）。
- `docs/features/history.md`: History（历史记录面板）。
- `docs/features/gallery.md`: Gallery（图库）模块说明文档。
- `docs/features/moodboard.md`: Moodboard（情绪板/风格素材集合）。
- `docs/features/tools.md`: Tools（实时视觉工具与 presets）。
- `docs/features/dataset.md`: Dataset（素材库与集合管理）。

后续新增模块文档时，必须同步补充到这里。

### 修改流程

修改任意模块时，按以下顺序执行：

1. 先阅读 `docs/` 中对应模块文档。
2. 先理解模块职责和边界，再修改代码。
3. 尽量做最小范围修改，避免无文档重构。
4. 修改后检查文档是否也需要同步更新。
5. 如果逻辑、依赖、接口、影响范围发生变化，必须更新对应文档。
6. 如果新增了模块文档，必须补充到本文件的“模块文档索引”中。

### 文档更新规则

如果代码逻辑发生变化，至少检查以下章节是否需要更新：

- 背景
- 模块职责
- 核心流程
- 输入 / 输出
- 依赖关系
- 状态 / 数据流
- 关键规则
- 边界 / 非职责范围
- 修改影响范围
- 更新记录

### 新增模块规则

新增模块时，必须：

1. 在 `docs/features/` 下新增对应模块文档。
2. 使用统一的模块文档结构（包含上述“文档更新规则”的章节）。
3. 在本文件的“模块文档索引”中补充入口。
4. 清楚写明：负责什么 / 不负责什么 / 谁依赖它 / 改动它可能影响什么。

### 冲突处理

如果发现代码和文档不一致：

1. 先核对当前代码真实行为。
2. 以实际实现为依据进行确认。
3. 修改完成后，把文档更新到与代码一致。
4. 不要保留已知不一致状态。

## 提交前自检清单

- 改动是否放在正确目录，没有把临时文件落到根目录。
- 前端请求是否仍然走同源 `/api/*`。
- 新后端逻辑是否遵守 `handler -> service -> repository` 分层。
- 新持久化逻辑是否只进入 `lib/server/repositories/`。
- repository 是否保持 `snake_case`，service / client DTO 是否保持 `camelCase`。
- SWR 与 Zustand 的职责是否被混淆。
- 变更文件是否超过体积阈值；如果超过，是否已先拆分。
- 新 provider 是否进入 `lib/ai/providers/`，并保持惰性加载。
- 逻辑、依赖、接口或影响范围变更后，相关 `docs/` 是否同步更新。
- 是否按改动范围运行了合适的验证命令，例如 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm ci:check`。
- 是否清理了 `.next/`、`report/`、Playwright 输出和其他运行时产物。

当文档、旧 wiki、现行代码之间存在冲突时，优先级按以下顺序判断：

1. 当前代码与 `package.json`
2. 根目录与 `docs/architecture/`、`docs/PROJECT_STRUCTURE.md`、`docs/ENVIRONMENT.md`
3. 其他说明文档
4. `docs/wiki/` 下的历史资料
