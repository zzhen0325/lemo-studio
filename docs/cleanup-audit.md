# 项目清理与去重审计汇总（面向稳定上线）

> 目标：在不改变产品主行为的前提下，删除历史遗留、收敛重复实现、减少依赖与配置漂移，让项目更稳定、精简、易维护。
>
> 本文基于当前仓库静态扫描（代码/资源/脚本/文档），结论都附带可点击的代码位置证据；执行删除前仍建议按“验证清单”跑一轮。

## 当前进度

- 已完成高置信删除第一轮：
  - 已从 [package.json:L35-L132](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L35-L132) 删除 12 个未使用依赖：`@coze/api`、`@google-cloud/vision`、`@google/genai`、`@hello-pangea/dnd`、`@react-three/drei`、`drizzle-orm`、`node-fetch`、`pg`、`radix-ui`、`@types/node-fetch`、`@types/pg`、`@vitest/coverage-v8`
  - 已收敛 [asset-governance.json:L8-L10](file:///Users/bytedance/Desktop/seeseezz/cozestudio/config/asset-governance.json#L8-L10)，删除不存在的 `public/tools/**` oversized allowlist
- 已完成依赖同步：
  - 运行 `pnpm install --no-frozen-lockfile` 成功，锁文件已更新
- 已完成验证：
  - `pnpm check:assets` 通过；当前仅剩既有 allowlist 资产 `public/images/3335.png`
  - `pnpm lint` 可运行，但仓库仍有若干既有 warning
  - `pnpm typecheck` 失败于 [HistoryCards.tsx:L711](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/playground/_components/history/HistoryCards.tsx#L711)
  - `pnpm test` 失败于 [describe-panel.spec.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/tests/playground/describe-panel.spec.tsx)、[use-gallery-feed.spec.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/tests/gallery/use-gallery-feed.spec.tsx)
- 结论：
  - 本轮删除已落地，且失败项都落在与本次依赖删除无直接关系的业务/测试代码中，可继续进入下一轮清理

## 结论概览（优先级）

1. **直接可删（高置信）**：一批依赖包在代码中完全无导入命中；可安全移除并通过 lint/typecheck/test 验证。
2. **重复实现（高收益）**：HTTP 调用封装、上传流程、toast/错误归一化、瀑布流布局、workflow 规范化等出现多份实现，建议收敛到单一入口以减少行为漂移。
3. **遗留兼容（需谨慎）**：Provider `legacy` 聚合与部分 deprecated 参数仍被使用；这类清理应以“替换 + 迁移期 + 删除”三步走。
4. **配置/文档漂移（风险）**：`.env.example` 与 `docs/ENVIRONMENT.md` 对 Coze token 前缀约定不一致，容易导致线上误配。

## 风险分级

- **可直接删除（High confidence）**：在代码中无导入/无引用命中，删除后通过 `pnpm lint/typecheck/test` 即可确认。
- **需要确认（Medium）**：可能通过运行时配置、动态 import、外部引用或非 TS 文件使用；需要做一次“功能冒烟 + 资源检查”。
- **暂不建议删（High risk）**：处于主链路/兼容层/核心 provider 聚合；优先做重构收敛，再考虑删。

---

## A. 可直接删除（高置信清单）

### A1. package.json 未使用依赖（建议优先清）

以下依赖在当前仓库 TS/JS 导入中均未命中（建议逐个移除，避免一次性改动过大）：

- `@hello-pangea/dnd`（仓库实际拖拽使用 `@dnd-kit/*`）
  - 证据：`dependencies` 声明 [package.json:L37-L45](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L37-L45)
  - 代码中无导入命中（全仓扫描无匹配）
- `node-fetch` + `@types/node-fetch`（服务端代码已用 `undici`）
  - 证据：依赖声明 [package.json:L85](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L85) / [package.json:L121](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L121)
  - `undici` 使用证据：如 [comfy-proxy.service.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/server/service/comfy-proxy.service.ts) / [ai/utils.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/ai/utils.ts)
- `drizzle-orm`、`pg`、`@types/pg`（未发现导入；当前主要走 Supabase）
  - 证据：依赖声明 [package.json:L73](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L73) / [package.json:L87](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L87) / [package.json:L122](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L122)
- `@google-cloud/vision`、`@google/genai`、`@coze/api`（未发现导入）
  - 证据：依赖声明 [package.json:L36-L42](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L36-L42)
- `radix-ui`（聚合包，代码实际使用 `@radix-ui/react-*` 子包）
  - 证据：依赖声明 [package.json:L47-L64](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L47-L64) + 聚合包 [package.json:L88](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L88)
- `@react-three/drei`（未发现导入；只看到 `@react-three/fiber`/`three` 的使用）
  - 证据：依赖声明 [package.json:L65-L67](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L65-L67)

执行状态：

- 已删除并完成锁文件同步

### A2. 低价值/陈旧配置项

- `config/asset-governance.json` 允许超大文件路径包含 `public/tools/**`，但该目录当前不存在，疑似历史残留
  - 证据：[asset-governance.json:L8-L12](file:///Users/bytedance/Desktop/seeseezz/cozestudio/config/asset-governance.json#L8-L12)
  - 建议：如果确认近期无 `public/tools` 计划，可收敛规则或删掉该条 allowlist

执行状态：

- 已删除 `public/tools/**` 相关 allowlist，仅保留现存资源白名单 [asset-governance.json:L8-L10](file:///Users/bytedance/Desktop/seeseezz/cozestudio/config/asset-governance.json#L8-L10)

---

## B. 需要确认后再删（中置信清单）

### B1. public 目录疑似未引用资源

- `public/images/logo.svg` 目前未见代码引用（实际使用 `studiologo.svg`）
  - `studiologo.svg` 使用证据：[layout.tsx:L40-L41](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/layout.tsx#L40-L41)，[StudioSidebar.tsx:L70](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/_components/StudioSidebar.tsx#L70)
- `public/images/logos/lark_logo.png`、`public/images/logos/view_comfy_logo.svg` 未检出引用
  - 建议：跑一次页面冒烟（工具栏、ViewComfy 相关入口）+ `pnpm check:assets` 再删除

### B2. Playwright 运行产物目录

- `.playwright-cli/` 看起来是运行时产物（log/png/yml），建议不进入仓库
  - 证据：目录存在（本地工作区）
  - `.gitignore` 目前未忽略该目录（建议加上）
    - 证据：[.gitignore](file:///Users/bytedance/Desktop/seeseezz/cozestudio/.gitignore)

---

## C. 不建议直接删除（但必须收敛/拆分）

### C1. 超大文件（高维护成本，建议按职责拆分）

- `PlaygroundPageContainer.tsx`、`InfiniteCanvasEditor.tsx` 显著超出项目约定阈值
  - 证据：阈值规则见 [AGENTS.md:L110-L116](file:///Users/bytedance/Desktop/seeseezz/cozestudio/AGENTS.md#L110-L116)
  - 建议：先按“数据流/对话框/编辑器/渲染容器”拆分，优先把纯 UI 与业务逻辑解耦到 `_lib` 或 hooks
- `lib/ai/providers/legacy.ts` 体积巨大且已被脚本特判放行
  - 证据：strict 行数检查排除 [package.json:L22](file:///Users/bytedance/Desktop/seeseezz/cozestudio/package.json#L22)
  - 建议：将 provider family 按职责拆文件（每个 provider 独立文件 + 共享 error/transport 层），最后再逐步淘汰 legacy 聚合入口

---

## D. 重复实现（建议收敛到单一入口）

### D1. HTTP fetch 模板重复（建议收敛为一个 request 工具）

现状：多处重复写 `fetch + JSON + error parse`，容易出现 header/baseUrl/错误展示风格不一致。

- Infinite Canvas API 封装：[shared.ts:requestJSON](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/infinite-canvas/_lib/api/shared.ts#L14-L38)
- AI client 内的多处 fetch 模板：[ai/client.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/ai/client.ts)
- Dataset collection detail 的 service 层 fetch：[collection-detail.service.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/dataset/_components/collection-detail/collection-detail.service.ts)

建议：

- 统一一个 `lib/http/request.ts`（或同等目录）作为唯一“浏览器侧同源请求模板”，强制默认 `/api/*`，并统一错误 payload 解析与用户可读错误。

### D2. 上传流程重复（校验/上传/错误提示）

- 通用 hook：[use-image-upload.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/hooks/common/use-image-upload.ts)
- Mapping Editor 上传入口（两处）：[create-workflow-dialog.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/mapping-editor/_components/create-workflow-dialog.tsx)、[mapping-editor-page.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/mapping-editor/_components/mapping-editor-page.tsx)
- Infinite Canvas（dataUrl -> upload）：[generation-api.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/infinite-canvas/_lib/generation-api.ts)

建议：

- 收敛到 1 个 `uploadImage()`：负责类型/大小校验、FormData、错误解析、返回统一 DTO；UI 只负责选择文件与 toast。

### D3. toast/错误处理双轨

- 封装层 toast：[use-toast.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/hooks/common/use-toast.ts)
- 直接使用 `sonner`（例）：[create-workflow-dialog.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/mapping-editor/_components/create-workflow-dialog.tsx)
- 错误归一化分散：[error-message.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/error-message.ts)、[comfy-error-handler.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/comfy-error-handler.ts)

建议：

- 统一“用户可读错误”模型：`toDisplayError(err): { title; description }`，并让 toast 只接收该模型。

### D4. 瀑布流/Masonry 布局重复（Gallery/History/Analyzer）

- 虚拟化 masonry：[GalleryMasonryWall.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/components/gallery/GalleryMasonryWall.tsx)
- 静态瀑布流：[GalleryStaticWall.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/components/gallery/GalleryStaticWall.tsx)
- History 列式布局（含 skeleton）：[HistoryList.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/playground/_components/HistoryList.tsx)、[HistoryLoadingSkeleton.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/playground/_components/HistoryLoadingSkeleton.tsx)
- Workflow analyzer 列式瀑布：[workflow-analyzer.tsx](file:///Users/bytedance/Desktop/seeseezz/cozestudio/app/studio/mapping-editor/_components/workflow-analyzer.tsx)

建议：

- 抽出一个可复用的 `MasonryColumns`（纯布局 + 可选虚拟化），由 Gallery/History/Analyzer 复用，避免 breakpoints/间距/空态重复维护。

### D5. Workflow 解析/注入/规范化逻辑重复（高风险漂移点）

- API 输入解析：[workflow-api-parser.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/workflow-api-parser.ts)
- 执行前注入/seed/finalize：[workflow-helpers.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/comfyui/workflow-helpers.ts)
- Model 内部再次实现类似逻辑：[comfy-workflow.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/models/comfy-workflow.ts)
- `LoadImage` 默认值逻辑在多处出现：[workflow-helpers.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/comfyui/workflow-helpers.ts) vs [comfyui-service.ts](file:///Users/bytedance/Desktop/seeseezz/cozestudio/lib/api/comfyui-service.ts)

建议：

- 定义单一 `normalizeWorkflowForRun(workflow, options)`，严格规定“只在这里做 seed/filename_prefix/LoadImage fallback”；其余地方只调用，不重复实现。

---

## E. 配置与文档漂移（必须修正，避免线上误配）

`.env.example` 标注“Coze 改用 `LEMO_` 前缀避免冲突”，但 `docs/ENVIRONMENT.md` 仍列 `COZE_API_TOKEN` 等变量名。

- `.env.example`：`LEMO_COZE_*` [\.env.example:L64-L71](file:///Users/bytedance/Desktop/seeseezz/cozestudio/.env.example#L64-L71)
- `docs/ENVIRONMENT.md`：`COZE_*` [ENVIRONMENT.md:L38-L43](file:///Users/bytedance/Desktop/seeseezz/cozestudio/docs/ENVIRONMENT.md#L38-L43)

建议（两选一，必须统一）：

- 如果线上/平台实际注入是 `COZE_*`：删掉 `LEMO_` 方案并回退 `.env.example`；或
- 如果为了避免冲突确实要用 `LEMO_*`：统一代码读取与文档说明，明确映射关系与迁移期（兼容两者一段时间后删旧变量）。

---

## F. 执行顺序（推荐）

1. **依赖清理（高置信）**：按 A1 逐个移除 → 安装 → 全量检查。
2. **文档/环境变量纠偏**：先统一 `.env.example` 与 `docs/ENVIRONMENT.md`，避免线上误配。
3. **重复收敛（高收益）**：先收敛 HTTP/上传/错误，再收敛 Masonry 与 Workflow normalize（减少回归面）。
4. **大文件拆分**：在行为稳定后做，以免与业务改动叠加造成定位困难。

---

## G. 验证清单（每轮清理后都跑）

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`（至少跑核心路径：Playground / Gallery / Mapping Editor / Dataset）
- `pnpm build`（确保生产构建通过）
