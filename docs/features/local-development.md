# 本地开发环境

## 背景

扣子部署使用平台数据库和对象存储，本机不能直接连接。开发环境使用独立 PostgreSQL 和本地图片目录，仍运行同一套 Next.js 页面、API、service 和 repository。

## 模块职责

- `pnpm dev:local` 启动本机数据库、PostgREST 和 Next.js。
- 数据库适配只切换连接，保留真实 SQL、分页、过滤和 RPC 行为。
- 本地文件存储提供上传、读取、删除、存在检查和图片显示 URL。
- 默认 `pnpm dev`、扣子 `.coze` 构建和启动入口保留原有行为。

## 核心流程

首次安装（macOS/Homebrew；Node 24、pnpm）：

```bash
brew install postgresql@17 postgrest
pnpm install --frozen-lockfile
pnpm dev:local
```

浏览器打开 `http://127.0.0.1:3001/studio/playground`。另开终端初始化三张明确标记为 `LOCAL DEMO` 的测试图片：

```bash
pnpm local:seed
```

重复初始化会跳过已有记录，不清空用户数据。测试图片在 Gallery 中可见；它们不属于新浏览器会话的私人 History。浏览器生成的图片属于当前会话，可在 History 中查看。

再次使用只需 `pnpm dev:local`。停止 Next.js 使用 Ctrl+C；停止数据库与 PostgREST 使用 `pnpm local:down`，数据保留。单独启动数据库使用 `pnpm local:up`。

换端口：`APP_PORT=3002 pnpm dev:local`；初始化时对应使用 `LOCAL_APP_URL=http://127.0.0.1:3002 pnpm local:seed`。

## 输入 / 输出

- `.env.local` 保留现有 AI Provider 凭据，不复制进版本库。
- `STUDIO_RUNTIME=local` 由本地启动脚本显式设置；未设置时继续使用扣子。
- 本地 PostgreSQL：`127.0.0.1:54329`，独立数据库 `studio_local`。
- PostgREST：`127.0.0.1:54321`，仅供服务端使用；浏览器仍请求同源 `/api/*`。
- 持久化文件：`.local/postgres/`（数据库）、`.local/objects/`（图片）。整个 `.local/` 不进 Git。
- `/healthz` 的 `runtime` 字段用于确认当前环境，初始化脚本拒绝操作非本地实例。

## 依赖关系

数据库业务 schema 统一由 `lib/server/repositories/migrations/` 管理。本地启动执行版本化迁移，再运行 `lib/server/repositories/local/schema.sql` 配置本地角色与授权。已执行版本通过校验后跳过，不再依据单张表是否存在判断初始化状态。详见 [数据库迁移](database-migrations.md)。

本地依赖 PostgreSQL 17 与 PostgREST。可通过 `LOCAL_POSTGRES_BIN` 指定 PostgreSQL 的 bin 目录，其他平台需自行安装对应命令。

## 状态 / 数据流

`浏览器 -> /api/* -> service -> repository -> 本地 PostgREST -> PostgreSQL`。

`上传/生成结果 -> 对象存储接口 -> 本地文件 repository -> .local/objects`。持久化使用稳定 storage key；显示 URL 通过 `/api/storage/local?key=...` 生成。已有 `/api/storage/image` 缩略图链路仍可使用。

## 关键规则

- 本地模式不读取扣子数据库凭据，也不会在连接失败时回退线上数据库。
- 本地 Next.js、数据库和 PostgREST 都绑定 loopback，仅用于本机开发。
- 本地文件接口在非本地模式返回 404；禁止路径穿越。
- 不要删除 `.local/` 来解决普通启动问题，它包含实际开发数据。
- 本地数据库和图片目录应一起备份；备份数据库原始文件前先 `pnpm local:down`。

## 边界 / 非职责范围

- 本地存储独立不代表 AI 模型离线运行。生成仍需要可访问的 Provider 和有效凭据；失败会正常返回错误，不用测试图伪装生成成功。
- 本地数据不是线上数据的镜像，不包含线上历史或线上对象。
- ComfyUI 目前仍沿用部署版的前端固定地址 `https://10.75.163.10:1000/`，需要本机能访问；本次验证使用 Seedream 4.5。
- 本地 PostgREST 仅用于兼容当前数据访问协议，不提供 Supabase Auth；本项目的登录继续使用原有 users/session 实现。

## 修改影响范围

影响本地所有数据库访问和 `src/storage/object-storage.ts` 的调用者，包括上传、生成结果保存、History/Gallery、Dataset。扣子连接与对象存储保持默认路径。

## 更新记录

- 2026-09-21：本地启动增加历史 config 条件更新 RPC 迁移；已有本地数据库也会应用，不修改历史记录。

- 2026-09-21：合并部署快照与本地 FluxKlein/Gallery 修改，增加独立本地数据库、文件存储、测试数据和运行入口。
