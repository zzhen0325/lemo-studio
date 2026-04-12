# Prompt AI Flows

## 背景

仓库内存在多种“会产出文本 prompt”的 AI 流程，但它们混用了“优化”“描述”“打标”“翻译”等表述，也容易把底层执行入口 `service:optimize` 与业务侧的 prompt 优化流程混为一谈。

本文件用于统一这三层语义：

- 执行层：`/api/ai/text`、`/api/ai/describe`、`/api/translate`，以及 `service:optimize` / `service:describe` / `service:datasetLabel`
- 业务层：真正的 prompt 优化流程与相邻流程
- 记录层：`historyRecordType`、`optimizationSource.sourceKind`、`promptCategory`

## 核心原则

- `service:optimize` 只是文本模型执行上下文，不是业务流程名。
- `prompt_optimization` 是 history 记录类型，不是通用文本生成类型。
- `optimized_generation` 是“基于优化后 prompt 发起的正常生成结果”分类，不是一次新的 prompt optimization record。
- `Describe`、`Dataset Label`、`Dataset Translate` 会产出 prompt 或文本，但默认不属于 prompt optimize。

## 全量流程矩阵

| 业务流程 | Flow Kind | 是否属于 Prompt Optimize | 输入形态 | 执行入口 | 返回结构 | 是否写 History | 回填方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Playground 普通文本优化 | `playground_plain_text` | 是 | 纯文本 prompt | `POST /api/ai/text` -> `service:optimize` | 4 条 prompt 变体文本 | 是，`prompt_optimization` | 当前输入框回填方案 A；生成结果分类为 `optimized_generation` |
| Playground Shortcut Inline 改写 | `playground_shortcut_inline` | 是 | Shortcut 当前文本态 | `POST /api/ai/text` -> `service:optimize` | 4 条 prompt 变体文本 | 是，`prompt_optimization` | 回填输入框 + shortcut editor document |
| Playground KV Structured 优化 | `playground_kv_structured` | 是 | KV shortcut 结构化字段 | `POST /api/ai/text` -> `service:optimize` | 结构化 variant JSON | 是，`prompt_optimization` | 回填 structured session 与 active variant |
| Infinite Canvas 文本节点优化 | `canvas_text_node` | 是 | 文本节点 prompt | `POST /api/ai/text` -> `service:optimize` | 4 条 prompt 变体文本 | 否 | 生成多个新文本节点 |
| Describe 图像转 prompt | `describe_image` | 否 | 图片 + focus prompt | `POST /api/ai/describe` -> `service:describe` | `{ text }` | 是，`image_description` | `Use Prompt` 回填为普通 prompt |
| Dataset 自动打标 / 生成 prompt | `dataset_label` | 否 | 图片 + dataset system prompt | `POST /api/ai/describe` -> `service:datasetLabel` | `{ text }` | 否 | 直接写入 dataset prompt 字段 |
| Dataset Prompt 翻译 | `dataset_translate` | 否 | prompt 文本数组 | `POST /api/translate` | `{ translatedText(s) }` | 否 | 直接写入 dataset prompt 双语字段 |
| Moodboard Prompt Template | `moodboard_prompt_template` | 否 | 图片 + 卡片上下文 | `POST /api/moodboard-cards/prompt-template` | `promptTemplate` | 否 | 写入 moodboard card 模版 |
| Image Edit Prompt 拼装 | `image_edit_prompt_assembly` | 否 | plain prompt + annotations | 本地拼装 | `finalPrompt` | 否 | 进入后续图像生成链路 |

## 不要混淆

| 名称 | 所属层级 | 含义 | 不代表什么 |
| --- | --- | --- | --- |
| `service:optimize` | 执行层 | 共享文本模型路由上下文 | 不代表 KV flow，不代表 history 类型 |
| `prompt_optimization` | 记录层 | 一次“提示词优化结果”的 history record | 不代表所有文本生成都属于它 |
| `optimizationSource.sourceKind` | 记录层 | 本次优化来源于 `plain_text / kv_structured / shortcut_inline` | 不代表底层 provider 或 HTTP route |
| `optimized_generation` | 记录层 | 正常生成结果来源于某次优化后的 prompt | 不是 `prompt_optimization` history record |
| `[Text]` | 执行请求标签 | 普通文本/shortcut inline/canvas text node 的共享文本请求标签 | 不是“普通文本 = 没有优化” |
| `[Event kv]` | 执行请求标签 | KV structured flow 的共享文本请求标签 | 不是独立 API |

## 关键规则

- `/api/ai/text` 可以被多个 prompt optimization flow 复用，但 history 语义必须由调用侧决定。
- `/api/ai/describe` 同时承载 Describe 与 Dataset Label，但两者属于不同业务流程。
- `/api/translate` 保持独立，不并入 prompt optimize。
- `Use Prompt` 只有在 `prompt_optimization` 记录上，才允许恢复 KV / shortcut 结构化编辑态。
- 普通生成记录即使携带 `optimizationSource`，也只能按普通 prompt 回填。

## 排除项

- Moodboard prompt template 是模板生成，不是 prompt optimize。
- Image Edit prompt assembly 是本地 prompt 拼装，不是 AI optimize。

## 更新记录

- 2026-04-12：新增 Prompt AI Flows 总览文档，统一执行层、业务层、记录层语义，并明确相邻流程边界。
