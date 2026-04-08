# seed4_0407_lemo 调用方法与 Key 整理

## 1. 快速结论
- 真正发起 `seed4_0407_lemo` 生图请求的服务端方法是 `BytedanceAfrProvider.generateImage`。
- 该模型请求不依赖 `provider.apiKey` 字段，使用的是签名参数：
  - `GATEWAY_BASE_URL`
  - `BYTEDANCE_AID`
  - `BYTEDANCE_APP_KEY`
  - `BYTEDANCE_APP_SECRET`
- `data/api-config/providers.json` 中 `provider-bytedance.apiKey` 当前为空，且当前代码路径不会读取它用于 `seed4_0407_lemo`。

## 2. 端到端调用链（按执行顺序）
1. 前端触发统一生图方法  
   `app/studio/playground/_components/hooks/useGenerationService.ts:308`  
   方法：`handleUnifiedImageGen(...)`
2. 前端调用 AI Hook  
   `hooks/ai/useAIService.ts:131`  
   方法：`callImage(...)`
3. 客户端请求 `/ai/image`  
   `lib/ai/client.ts:103`  
   方法：`generateImage(...)`
4. Next Route 代理到服务端  
   `app/api/ai/image/route.ts:54`  
   方法：`POST(...)` -> 代理到 `/api/ai/image`
5. 服务端 AI 服务接收并分发模型  
   `server/service/ai.service.ts:107`  
   方法：`generateImage(...)`
6. Provider 工厂按 modelId 选择 `bytedance-afr`  
   `lib/ai/modelRegistry.ts:108`  
   方法：`getProvider(...)`，返回 `new BytedanceAfrProvider(config)`
7. 最终请求字节 AFR 接口  
   `lib/ai/providers.ts:529`  
   方法：`BytedanceAfrProvider.generateImage(...)`

## 3. seed4_0407_lemo 的直接命中点

### 3.1 运行时相关（会影响请求行为）
- `lib/ai/registry.ts:76`  
  注册 `id: 'seed4_0407_lemo'`，providerType 为 `bytedance-afr`。
- `lib/ai/providers.ts:556`  
  `this.config.modelId === "seed4_0407_lemo"` 时走 `Prompt` 提交分支。
- `lib/store/playground-store.ts:398`  
  模型为 `seed4_0407_lemo` 时，默认 `imageSize = '2K'`。
- `lib/adapters/data-mapping.ts:87`  
  历史配置迁移时，`seed4_0407_lemo` 若无 `imageSize`，默认补成 `2K`。

### 3.2 UI/配置相关（不直接发请求）
- `app/studio/playground/_components/hooks/useGenerationService.ts:33`  
  可选模型列表包含 `seed4_0407_lemo`。
- `app/studio/playground/_components/ControlToolbar.tsx:124`、`:190`、`:275`  
  控制是否支持尺寸选择、模型展示文案等。
- `data/api-config/providers.json:291`  
  `provider-bytedance` 下配置了 `modelId: "seed4_0407_lemo"`。

## 4. Key 与鉴权来源

### 4.1 seed4_0407_lemo 实际使用的 key
文件：`lib/ai/providers.ts:532`

`BytedanceAfrProvider.generateImage(...)` 里使用：
- `BASE_URL = process.env.GATEWAY_BASE_URL || "https://effect.bytedance.net"`
- `AID = process.env.BYTEDANCE_AID || "6834"`
- `APP_KEY = process.env.BYTEDANCE_APP_KEY || <代码内默认值>`
- `APP_SECRET = process.env.BYTEDANCE_APP_SECRET || <代码内默认值>`

然后通过 `nonce + timestamp + APP_SECRET` 生成签名，随 query 参数发送到：
- `/media/api/pic/afr`

### 4.2 为什么 `provider.apiKey` 不生效（针对 bytedance-afr）
- `lib/ai/modelRegistry.ts:37` 的 `PROVIDER_ENV_MAP` 没有 `provider-bytedance`。
- `lib/ai/modelRegistry.ts:182` 对 `bytedance-afr` 不执行“缺少 apiKey 抛错”。
- `BytedanceAfrProvider.generateImage(...)` 内部完全未读取 `this.config.apiKey`。

结论：`seed4_0407_lemo` 当前鉴权逻辑是“签名参数模式”，不是“Bearer API Key 模式”。

## 5. 补充说明
- `.env.example` 当前未声明 `BYTEDANCE_APP_KEY` / `BYTEDANCE_APP_SECRET` / `BYTEDANCE_AID` / `GATEWAY_BASE_URL`。
- 若要规范化维护，建议把这四个变量补充到 `.env.example` 和部署环境配置中，避免依赖代码内默认值。
