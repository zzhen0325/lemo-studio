# CozeStudio 数据库现状与清理顺序

## 核对范围与结论

2026-09-21 核对当前 route、service、repository、`lib/server/db/models.ts`、建库 SQL 和本地 PostgreSQL 元数据。数据库操作全部使用只读事务，只查询表、列、函数、约束与 RLS 信息，未读取用户记录或修改数据。

- 初次本地 `studio_local` 实查：13 张业务表、2 个 public RPC、13 个主键约束、3 个唯一约束、0 个外键约束。后续参考图同步修复新增 `update_owned_history_config`，当前本地为 3 个 RPC。
- 线上数据库未连接；线上字段、RPC、RLS、索引与数据格式不能由本地结果推定。
- 当前主存储是 PostgreSQL/PostgREST，通过 Supabase SDK 访问；MongoDB 风格 API 是旧适配层，不代表仍连接 MongoDB。
- 初次梳理只更新文档；随后已修复 History owner 写入、停用旧 URL 修复接口、修复惰性查询和参考图同步。验证使用本地临时记录，结束后删除并核对清理结果；未执行线上迁移。

优先级应按数据归属与完整性、查询正确性、schema 可重建性、分层与命名依次推进，不能只按文件大小拆分。

## 实际访问链路

```text
浏览器 → 同源 /api/* → service → repository → db/models.ts
                                           → Supabase SDK
                                             ├─ 扣子 Supabase
                                             └─ 本地 PostgREST → PostgreSQL
图片二进制 → src/storage/object-storage.ts → 云对象存储 / 本地 .local/objects
```

代码入口：

- [连接选择](../../src/storage/database/supabase-client.ts)：`STUDIO_RUNTIME=local` 时走本地连接；默认走扣子凭据加载。
- [本地客户端](../../lib/server/repositories/local/database-client.ts)：仅允许 loopback HTTP；去掉 SDK 的 `/rest/v1` 前缀与认证头，不把云凭据带到本地。
- [持久化适配层](../../lib/server/db/models.ts)：1,490 行，包含 11 个 Model、字段转换、链式查询和 Mongo 风格写入兼容。
- [Repository](../../lib/server/repositories/)：9 个业务 repository，多数继续依赖 Model，尚未直接封装完整 SQL/PostgREST 语义。
- [本地初始化](../../scripts/local/services.sh)：执行统一版本化业务迁移，再应用本地角色授权，不再只检查 generations 表。

其他持久化源仍然有效：

- `data/infinite-canvas/projects.json`：Canvas 自动降级源及旧数据迁移源。
- `data/api-config/providers.json`：Provider 文件配置源，不属于数据库。
- `config/preset-catalog.json`、`config/style-catalog.json`：冷启动导入源。
- 客户端 SWR 是服务端缓存；Zustand 保存 editor/UI 与临时 history overlay，不应成为第二套持久化真值。

## 表与业务边界

以下列出核心字段，完整定义以两份 SQL 与 Model 实现为准。

| 表 | 职责与主要字段 | 当前访问入口 |
| --- | --- | --- |
| `users` | 用户；`id/display_name/avatar_url/password` | UsersRepository；`/api/users` |
| `generations` | History/Gallery；`user_id/project_id/output_url/config/status/progress/progress_stage`、四类互动计数与时间 | HistoryRepository；`/api/history`；interaction service |
| `generation_likes` | 点赞关系；`generation_id/user_id`，组合唯一约束 | interaction service 直接读写 |
| `image_assets` | 对象索引；`storage_key/url/dir/file_name/region/type/meta` | ImageAssetsRepository；上传、保存图片、Dataset |
| `dataset_collections` | 集合；`name/system_prompt/order_arr/count` | DatasetRepository；`/api/dataset` |
| `dataset_entries` | 条目；`collection_name/file_name/url/prompt/prompt_zh/prompt_en/order_idx`、尺寸与 metadata | DatasetRepository；`/api/dataset` |
| `infinite_canvas_projects` | 项目整份快照；`project_id/user_id/project_name/cover_url/node_count/canvas_viewport/last_opened_panel/nodes/edges/assets/history/run_queue` | InfiniteCanvasRepository；`/api/infinite-canvas/projects*` |
| `moodboard_cards` | 卡片、模板、发布；`code/name/sort_order/is_enabled/cover_storage_key/cover_url/model_id/prompt_template/prompt_fields/prompt_config/gallery_order/publish_status/published_at` | MoodboardCardsRepository；`/api/moodboard-cards*` |
| `presets` | 生成/编辑预设；`name/cover_url/config/edit_config/category/type/project_id` | PresetsRepository；`/api/presets` |
| `preset_categories` | 分类列表；`key/categories` | PresetsRepository；`/api/presets/categories` |
| `style_stacks` | 仍在使用的旧风格集合；`name/prompt/image_paths/preview_urls/collage_image_url/collage_config` | StylesRepository；`/api/styles` |
| `tool_presets` | 工具参数；`tool_id/name/values/thumbnail/timestamp` | ToolPresetsRepository；`/api/tools/presets` |
| `site_stats` | 站点累计统计；`key/count/updated_at` | `/api/stats` 直接访问；HistoryRepository 记录生成数 |

### JSON 与关系约束

- `generations.config` 保留生成参数、模型、尺寸、LoRA、`sourceImageUrls/localSourceIds`、`isEdit/parentId/editConfig/imageEditorSession` 以及 `historyRecordType/promptCategory/optimizationSource`。
- Canvas 以项目整份 JSON 快照存储，节点、边、资产和运行队列没有独立关系表。
- Moodboard 的 prompt 字段、默认参数和图集顺序也使用 JSON 数据。
- 本地没有外键：例如 `generation_likes.generation_id`、`image_assets.generation_id`、Dataset 的集合名称关联，均不能依赖数据库自动校验或级联清理。
- `user_id` 可能是游客 actor UUID，不能直接添加指向 `users` 的外键，否则会破坏游客生成流程。
- 图片优先保存稳定 storage key，显示时再生成 URL；旧 URL 兼容不能在未核对存量数据前删除。

## 归属与访问作用域

[session.ts](../../lib/server/auth/session.ts) 使用签名 cookie：游客 `actorId` 是随机 UUID，登录用户 `actorId=userId`。登录迁移由 Users 流程触发。

| 数据/入口 | 当前语义 |
| --- | --- |
| History 私有查询 | `mine=1` 或携带 userId 查询参数时，以服务端 session actor 过滤；不采用请求提供的 userId 值 |
| History 公共查询 / Gallery | 未要求私有模式时查询公共记录；不能把整个 History API 描述为私有 |
| History 保存与删除 | route 传入服务端 actor；但默认保存与底层更新存在归属缺陷，见下文 |
| Canvas | service 检查 owner；无 owner 项目允许首访 claim；repository 的写入条件仍需加强 |
| Dataset、Presets、Styles、Tools、Moodboard | 当前为共享数据，不能未经产品定义就统一加 user_id 隔离 |
| 运维接口 | 部分接口直接写表，不能因为位于 `admin/` 就认定已经受管理员权限保护 |

本地实查：12 张基线表开启 RLS，但策略均为 `FOR ALL USING (true)`；`site_stats` 没有开启 RLS。该配置没有提供 owner 隔离，不能替代应用层权限。线上实际策略待核对。

## 已确认问题与优先级

### 已修复 History 写入路径：历史记录覆盖与 owner 条件丢失

修复前证据（底层 Model 缺陷仍待清理，History 受保护写入已绕开）：

- [HistoryService.saveHistory](../../lib/server/service/history.service.ts) 默认分支接受请求中的记录 ID，用当前 actor 构造 `user_id` 后调用 upsert。
- [HistoryRepository.upsert](../../lib/server/repositories/history.repository.ts) 只按 ID 查找已有行；存在时直接更新整份记录，包括 `user_id`，没有校验已有 owner。
- [GenerationModel.updateOne](../../lib/server/db/models.ts) 在 filter 有 `id` 时只追加 ID 条件，丢掉传入的其他条件，包括 `user_id`。因此 `updateOwned` 的命名并不代表实际写入受 owner 条件保护。

影响：已知其他记录 ID 的请求可能覆盖记录并改写归属。batch-update 虽有先读 owner 检查，后续写入仍缺少原子 owner 条件。不能把“换会话后同 ID 更新成功”视为允许跨 owner 更新的理由。

隔离验证：用内存 PostgREST stub 执行真实 Model，输入 `{ id, user_id }`，实际记录到的 update filter 只有 `id`；未写真实数据。

修复结果：HistoryRepository 先 insert，主键冲突后只按 ID + owner 更新；普通更新剔除 id/user_id，未匹配返回 409。HistoryService 将写入编排移至 `history-write.service.ts` 并保留冲突状态；独立登录迁移入口保留。

本地 PostgreSQL 实测通过：同 owner 并发重试只新增一条、不同 owner 覆盖被拒绝且原记录不变、迁移后的旧 owner 写入被拒绝、新 owner 可重试、不同 owner 同 ID 并发创建只有一方成功。底层通用 Model 的 updateOne 尚未全局修复，其他域需继续审计。

### 已停用：旧 URL 维护接口会覆盖完整地址

[app/api/admin/fix-urls/route.ts](../../app/api/admin/fix-urls/route.ts) 的 POST 将匹配的 `generations.output_url` 和 `dataset_entries.url` 更新为固定目录前缀，而非为原值补前缀，原文件名会丢失。该 route 未见管理员鉴权，当前 middleware 也直接放行。

修复后该入口的 GET/POST 均返回 410，完全移除数据库读写和固定前缀逻辑；回归测试验证不会建立数据库连接。尚未部署，线上状态未确认。如未来需要清理存量 URL，应另行制定有差异预览的迁移，不恢复此入口。

### 已修复：链式查询在组装过程中重复执行

修复前 `createQueryable` 一进入就调用 `executeQuery/executeSingle`；`.sort/.limit/.lean` 每次又重新调用 `createQueryable`。

隔离验证真实 Model：`find({ user_id }).sort({ created_at: -1 }).limit(10).lean()` 共发起 **4 次查询**，其中前两次尚未带 limit。测试仅用内存客户端记录请求。

影响：重复数据库往返、无分页的额外读取，以及无人等待的中间 Promise 的错误处理风险。当前 History 分页使用专门的 `findWithPagination`，不能把此结论套到所有查询；Dataset 等仍使用链式接口。

修复后查询兼容层位于 `repositories/compat/query.ts`，组装不执行请求；await/then/catch/finally/exec 共用同一个 Promise。过滤、排序、投影和分页行为保留；单条查询和错误传播有回归覆盖。本地数据库验证完整查询链只发一次请求。长期仍应逐域换成显式 repository 查询。

### 已修复服务端持久化：上传引用同步返回成功但未落库

`playground-store.ts` 的 `syncLocalImageToHistory` 会发送 `action=sync-image`；修复前 HistoryService 对该动作只打印占位日志并返回成功。

影响：本地 overlay 已换成 storage key，不代表历史 config 已同步；刷新/跨会话复用可能仍读到旧引用。此前上传 hook 的拆分保留了这条旧行为，测试中的 store 回调成功不构成数据库落库验证。

修复后 `history-image-sync.repository.ts` 按 actor 与 local ID 查询，按 ID 游标分页，只替换已存在的匹配参考图位置。调用 `update_owned_history_config` RPC，通过 POST 请求体传递完整 config 快照作为写入条件，冲突时重读合并，最多写入重试 5 次后返回 409；数据库错误返回失败。多条记录非整体事务，失败可重试。该 RPC 定义于 `lib/server/repositories/migrations/0003_history_config_cas.sql`，已应用本地，线上尚未应用；部署新代码前需先执行此幂等迁移。

本地数据库回读确认：200 KB config 经 POST 成功同步、旧快照与错误 owner 被数据库拒绝、参考图持久化、多个匹配位置全部替换、嵌套 config 保留、其他 owner 记录不变、重复同步无 UPDATE。同步不创建未落库记录，也不覆盖同步之后新建的记录；上传与生成的更广泛时序协调不在此修复范围内。

### P2：互动关系和计数不可靠

[interaction.service.ts](../../lib/server/service/interaction.service.ts)：

- Moodboard 去重查询 `style_stacks.generation_id/moodboard_id`，两列在本地实际表和仓库 schema 中均不存在；查询错误未处理，也没有在该流程写入独立去重关系。
- download/edit/moodboard_add 是先读计数再写 `count + 1`，并发可能丢增量。
- 点赞关系有唯一约束，计数优先走 RPC，但关系插入和计数递增不是同一个事务；RPC 失败后的普通读写也存在并发风险。
- 新增 generation 与站点统计分开执行，统计错误被吞掉；`generated_images` 不能当严格一致的记录总数。

应先定义 Moodboard 关系的唯一键与重复加入语义，再通过 repository 封装事务/RPC，避免只新增一个计数字段。

### P2：Canvas 主存储和归属边界

[InfiniteCanvasService](../../lib/server/service/infinite-canvas.service.ts) 在特定连接错误或超时后切换 JSON，当前 service 实例后续直接使用 JSON；超时不取消已发出的主存储请求。因此可能同时出现迟到的数据库写入和文件写入，多实例也无法共享该文件。

[InfiniteCanvasRepository](../../lib/server/repositories/infinite-canvas.repository.ts) 的 `claimOwner/upsertOwned` 主要按 project ID 写入；service 虽然先读检查，但 claim 未使用“owner 仍为空”的原子条件。清理应保留迁移能力，同时明确唯一写入源、恢复策略和 owner 条件，不能直接删除 JSON 文件。

### P2：分层与字段边界未落地

- 绕 repository 的路径包括 interaction service、`/api/stats`、`/api/admin/fix-urls`、`/api/admin/cleanup-bare-image-urls`、`/api/health` 的连通性探测。运维探测与业务写入应分别处理。
- DatasetRepository 仍暴露通用 filter 与 upsert options，调用者仍需了解底层查询形态。
- `InfiniteCanvasProjectDoc` 同时保留 snake_case 和 camelCase；repository 的列表排序也同时读取两种时间字段。
- `utils/mongo.ts` 不仅还原 `_DOT_`，还递归转换 snake_case。Canvas 与 Dataset 仍调用它，不能机械删除或对任意 JSON 键统一转换。
- `models.ts` 大量 `any`、通用写入接口及结果计数使“类型通过”不足以证明数据库行为正确。

## Schema 基线与本地/线上差异

此前初始化分为根目录 SQL 与本地补充。下表记录统一前的差异；现在所有业务字段与 RPC 均进入 `lib/server/repositories/migrations/`，根目录 SQL 是生成快照，本地 schema 只保留角色授权：

| 能力 | 根目录基线 | 本地补充 / 本次本地实查 |
| --- | --- | --- |
| `users.password` | 无 | 有 |
| `image_assets.storage_key` | 无 | 有 |
| Dataset `prompt_zh/prompt_en/order_idx` | 无 | 有 |
| Collection `system_prompt/order_arr` | 无 | 有 |
| `preset_categories.key` 默认值 | 未提供 `default` 默认值 | 已补充 |
| `site_stats`、`increment_site_stat(p_key text, p_delta integer)` | 无 | 有 |
| `increment_like_count(p_generation_id text, p_now timestamptz)` | 无 | 有 |
| `style_stacks.generation_id/moodboard_id` | 无 | 无 |

现在通过 `studio_migrations.versions` 记录版本、文件名、校验值和执行时间。所有待执行迁移与 ledger 在单个加锁事务内提交；已应用文件变更、未知版本、历史缺口均拒绝。空库和兼容的既有库共用此链，不自动执行旧 Canvas/shortcuts 破坏性数据转换。线上尚未应用；步骤见 [数据库迁移](../features/database-migrations.md)。

## 保留的业务契约

- History/Gallery 共用 `generations`；lightweight/minimal 当前仍读取相同字段投影，差异主要是 DTO 与 URL/互动处理。优化投影需先核对详情恢复需求。
- Dataset 图片上传涉及对象存储、image_assets、dataset_entries；集合更名/删除与条目关系必须成对核对。写入后的 SSE 使用进程内 EventEmitter，不能假设跨实例通知可靠。
- `style_stacks` 仍有 API 与迁移消费者，不能仅因 Moodboard 已上线就删表。
- `migrate-user-history` 的 History 入口仍返回空迁移结果，真正迁移在用户登录流程；`cleanupStaleGenerations` 也是占位实现。
- 已有迁移包括 Canvas v2、旧 shortcuts 表更名、过期 URL 清理和 styles→shortcuts；它们是迁移资产，不应作为自动请求时反复执行的逻辑。

## 分批执行顺序与验收

1. 已完成 History owner 写入修复与旧维护入口停用；本地数据库并发/跨 actor 验证和入口无数据库访问测试通过，线上部署待完成。
2. 已完成链式查询执行时机与 sync-image 持久化；请求次数与本地数据库回读验证通过。
3. 已统一 schema 和版本化迁移；通过空库、旧库、重复执行、并发、回滚及自定义策略保留测试，本地已接管版本记录。
4. 独立 interaction repository 与事务 RPC，明确 Moodboard 关系；验证重复请求和并发计数。
5. 逐域移除 Model 兼容接口，先 History、再 Dataset、再 Canvas；保持 service/client DTO 稳定，不一次性替换所有表。
6. 处理 Canvas 降级策略、JSON 键兼容及 DTO 别名；根据存量数据抽样决定迁移，最后删除已无消费者的兼容层。

下一批从第 4 项继续；第 4–6 项尚未实施。线上 schema、修复部署和线上接口可达性未验证。

## 更新记录

- 2026-09-21：拆出惰性查询兼容层，修复重复请求；实现按 owner 隔离的历史参考图同步与并发 config 保护，通过本地数据库回读验证。

- 2026-09-21：修复 History owner 写入并停用 fix-urls；全量 302 个测试、类型检查及本地数据库临时记录验证通过。

- 2026-09-21：只读核对本地 13 表与 2 个 RPC；补充站点统计、schema 双基线、owner 条件丢失、查询重复执行和维护接口覆盖风险；明确代码验证与线上未验证的边界。
