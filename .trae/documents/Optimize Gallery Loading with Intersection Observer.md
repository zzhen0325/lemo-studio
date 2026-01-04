## 现状与问题

* 已集成 Google Gemini（SDK）、Doubao 与 DeepSeek（OpenAI 兼容 REST）。

* 同一能力分散在多个路由与 Hook，文本优化与图片描述分别实现，重复构造消息与解析结果。

* 系统提示来源不统一：数据集 `systemPrompt`、优化 `systemInstruction`、页面内默认值并存，覆盖策略不一致。

* 视觉消息格式差异（OpenAI 兼容 vs Gemini）在各处手写，扩展新模型需要重复修改多处代码。

## 目标

* 一次性抽象出统一的模型提供方接口，隐藏差异、统一错误与流式输出；前端与服务端只关心 `provider/model` + 任务类型。

* 用“系统提示配置档案（profiles）”解决同一模型在不同场景的关键词差异，提供可控的覆盖优先级。

* 新增模型仅需注册，无需复制粘贴现有路由/Hook 逻辑。

## 技术方案

### 1) Provider 接口与实现

* 接口：`TextProvider`（文本对话/优化）、`VisionProvider`（图像描述/多模态）统一签名：

  * `generateText({ input, systemPrompt, options }): Promise<TextResult>`

  * `describeImage({ image, systemPrompt, options }): Promise<TextResult>`

* 实现：

  * `OpenAICompatibleProvider`：`baseURL`、`model`、`apiKey`，适配 Doubao、DeepSeek、以及后续 Qwen/其他 OpenAI 兼容。

  * `GoogleGenAIProvider`：封装 `@google/genai` 的 `generateContent` 与 `inline_data` 图像消息结构。

* 统一：错误类型、重试策略、`maxTokens/temperature/top_p` 等参数；支持 `stream` 开关并暴露标准化流。

### 2) 模型注册中心

* `modelRegistry.ts`：

  * 结构：`{ providerId, modelId, task: ['text','vision'], factory: () => Provider }`。

  * 预置：`doubao/*`、`deepseek/*`、`gemini/*`；新增模型只添加一条注册项即可。

* 环境来源：统一从设置存储或 `process.env` 获取 `apiKey/baseURL`，请求可临时覆盖。

### 3) 统一服务端路由

* 新增：`/api/ai/text`、`/api/ai/describe` 两个路由：

  * 入参：`{ provider, model, profileId?, systemPrompt?, options?, stream? }`。

  * 逻辑：通过 `modelRegistry` 动态派发到对应 Provider；支持流式与非流式统一响应格式。

* 兼容旧路由：旧路由内部转发到新统一路由，逐步迁移后可下线。

### 4) 系统提示配置档案

* `config/system-prompts.ts`：

  * 结构：`{ profileId: { defaultPrompt, perProviderOverride?: { providerId: stringPrompt } } }`。

  * 优先级：`请求显式 systemPrompt > 数据集 metadata.systemPrompt > profileId 映射 > 路由默认`。

* 面向场景：如 `prompt_optimization`、`image_describe_short/long` 等，多处共享但可细粒度覆盖。

### 5) 前端统一客户端与 Hook

* `lib/ai/client.ts`：封装调用 `/api/ai/*`，入参统一，返回标准化结果。

* Hook：

  * `useModelText({ provider, model, profileId, systemPrompt, options })`。

  * `useModelDescribe({ provider, model, profileId, systemPrompt, options })`。

* 更新页面与设置：模型选择与 API Key 管理保持不变，仅切换到统一客户端；保留向下兼容路径。

### 6) 日志与监控

* 统一请求/响应日志结构、错误码与用户提示文案；在流式场景记录事件边界与耗时。

## 迁移步骤

1. 引入 Provider 接口与 `OpenAICompatibleProvider`/`GoogleGenAIProvider` 基本实现。
2. 建立 `modelRegistry` 并注册现有模型；落地两个统一路由。
3. 先让旧路由转发到新路由，验证一致性与性能。
4. 前端 Hook/调用点切换到统一客户端与 `profileId`；完成后移除重复代码。
5. 增加单元测试：Provider、注册中心、系统提示优先级、路由入参校验与错误处理。

## 添加新模型流程

* OpenAI 兼容：只在 `modelRegistry` 注册 `baseURL/modelId`，前端选择即可。

* 特定 SDK：新增 Provider 实现并注册，沿用统一路由与 Hook，无需动其他模块。

## 预期收益

* 新模型接入时间显著缩短；同一模型多场景提示可控、可审计。

* 统一错误与流式输出，减少前后端重复代码与维护成本。

* 路由与 Hook 简化，降低回归风险。

