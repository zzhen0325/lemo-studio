# 数据库 schema 与版本化迁移

## 背景

过去业务 schema 分散在根目录 SQL、本地补丁和独立 RPC 脚本中，启动仅检查一张表，无法判断整库版本。现在空库初始化和已有库升级使用同一条迁移链。

## 模块职责

- `lib/server/repositories/migrations/`：唯一手写的版本化业务 schema 来源。
- `scripts/db/migrations.mjs`：读取版本与 SHA-256，生成事务式迁移 SQL。
- `scripts/db/migrate.mjs`：生成、检查、查询版本和应用迁移。
- `supabase-schema.sql`：由迁移链生成的可执行快照，可直接用于 PostgreSQL SQL Editor；不要手改。
- `lib/server/repositories/local/schema.sql`：仅保留本地角色和授权，不定义业务表或 RPC。

## 核心流程

### 查看与应用

需要安装 PostgreSQL 客户端。通过 `PGHOST`、`PGPORT`、`PGUSER`、`PGDATABASE` 显式选择数据库，认证使用 `PGPASSFILE` 等 PostgreSQL 标准机制；不要把密码写进命令或文档。可用 `PSQL_BIN` 指定 psql 路径。工具不读取扣子凭据，也不自动猜测线上目标。

本地例子：

```bash
export PGHOST=127.0.0.1 PGPORT=54329 PGUSER=studio_admin PGDATABASE=studio_local
export PSQL_BIN="$(brew --prefix postgresql@17)/bin/psql"
pnpm db:status
pnpm db:migrate
```

`pnpm dev:local` / `pnpm local:up` 已自动执行业务迁移，再应用本地角色授权。应用启动和扣子部署脚本不自动修改线上数据库。

线上发布前：确认目标和备份，查看版本，使用有 DDL 权限的连接执行 `pnpm db:migrate`；若只有平台 SQL Editor，可执行生成的完整 `supabase-schema.sql`。两者使用相同版本记录、校验与事务，随后再部署依赖新 schema 的应用。

### 新增迁移

1. 在 migrations 目录增加后续版本，如 `0004_description.sql`；已应用文件保持不变。
2. SQL 不自行包含 `BEGIN/COMMIT`，不使用 psql 元命令，也不能使用需要事务外执行的操作（如 `CREATE INDEX CONCURRENTLY`）。
3. 执行 `pnpm db:schema` 更新根目录快照，执行 `pnpm db:check` 检查一致性。
4. 验证旧版本升级、失败回滚与已有数据保持后，再应用目标环境。

迁移当前按固定四位数字排序；版本不能重复，也不能在已执行版本前插入缺失版本。后续超出编号范围时应先升级编号契约。

## 输入 / 输出

- 输入：编号 SQL、显式数据库连接、已有版本记录。
- 输出：更新后的业务 schema 和 `studio_migrations.versions`。
- 版本记录包含 `version/name/checksum/applied_at`，位于独立 schema，不在 PostgREST 的 public 暴露范围内；PUBLIC 没有该 schema 的权限。
- `db:status` 只读，输出 applied/pending/MISMATCH/UNKNOWN；`db:check` 不连接数据库。
- 旧 `scripts/migrate-history-config-cas.sql` 仅保留 psql 转发入口，执行完整受版本控制的快照，不再单独维护 RPC 定义。

## 依赖关系

- PostgreSQL、psql、Node.js；不引入额外包。
- 本地启动、History config 同步和后续数据库升级依赖迁移链。
- 当前版本：0001 支持的基线，0002 共享业务字段及统计，0003 History config 条件更新 RPC。

## 状态 / 数据流

`迁移文件 → SHA-256 → 生成 SQL → 事务级 advisory lock → 版本检查 → 待执行 SQL + 版本记录 → COMMIT → PostgREST schema reload`。

一轮所有待执行迁移与记录在同一事务内完成；任何错误均回滚整轮。并发执行器通过固定数据库事务锁串行化，等待锁超过 30 秒会失败，可重试。

## 关键规则

- 已应用版本的文件名或内容变更、未知数据库版本、版本缺口均阻止执行；修复应恢复原迁移并新增版本，不能直接修改 ledger 掩盖漂移。
- `db:status` 和校验值验证迁移历史，不是完整在线 schema 漂移检测；手工改表不一定能被识别。
- 无版本记录的既有库会执行可兼容的基线和补丁，再建立版本记录。不会只因 `generations` 存在就跳过整库初始化。
- 旧 `playground_shortcuts` 表或缺少 `project_id` 的旧 Canvas 结构会明确拒绝。其数据转换仍需单独审查，不能自动套用包含删列/删约束的历史脚本。
- 既有表的 RLS 启用状态和策略保持不变；新基线表保留原有宽松策略。此轮统一 schema 不等于加强了生产 RLS，也不改变共享数据产品语义。
- 迁移不删除历史列、表或业务记录；工具 timestamp 从 INTEGER 扩宽到 BIGINT。超出已支持基线的结构不保证自动修复，失败会回滚。
- 本地角色和授权只在本地入口执行，不出现在可部署业务快照中。

## 验证

```bash
pnpm db:check
# 使用上面的本地 PGHOST/PGPORT/PGUSER/PSQL_BIN
pnpm test:db-migrations
```

数据库集成测试强制 loopback，创建随机命名的独立测试库，覆盖空库、旧库、已手动打补丁库、部分初始化、幂等、校验值拒绝、回滚、并发、未知/缺失版本与旧布局拒绝，结束后删除自己创建的库。账号需要建库权限；进程被强制终止可能留下 `studio_migration_test_*` 测试库，需确认归属后清理。

## 边界 / 非职责范围

- 不连接或迁移线上数据库，不处理对象存储内容，不自动回退生产版本。
- 不执行历史 URL 数据修复、Canvas v2 数据迁移或 Moodboard 关系重构。
- 不解决所有 Model 兼容接口、互动计数一致性或 Canvas JSON 降级问题。

## 修改影响范围

影响新环境初始化、已有环境升级、本地启动及数据库发布步骤。迁移失败时本地启动中止，不继续运行在半升级数据库上。普通前端/API DTO 保持不变。

## 更新记录

- 2026-09-21：统一三份 schema 为三步迁移链，增加私有版本记录、校验、事务锁及生成快照；验证隔离库升级，并接管本地 studio_local，确认 13 张业务表数据指纹未变。
