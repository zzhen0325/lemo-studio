```markdown
## 一、 背景与目标

当前 Lemo AI Studio 的架构在快速迭代初期展现了灵活性，但随着模型和功能点的增加，逐渐暴露了一些维护性问题：

- **分散的调用逻辑**：各类 AI 模型（ComfyUI, Coze, Google GenAI, 智创网关等）的调用逻辑散落在 `PlaygroundV2` 页面的不同分支中，新增或修改模型影响范围大，且难以复用。
- **混乱的配置管理**：模型参数、生图预设（Preset）与 UI 配置耦合，缺乏统一的管理和复用机制。
- **不一致的接口契约**：不同模型服务的返回结构各异，前端需要编写大量适配代码来处理，增加了 UI 层的复杂性。

为解决上述问题，本次轻量架构优化的核心目标是：**在最小化改造现有代码的前提下，建立一套集中化、可复用、易扩展的模型与配置管理体系**。

我们不追求一步到位实现复杂的“管道引擎”或“DSL”，而是采用一套“**集中配置 + 单一服务层**”的务实方案，力求在 1-2 周内快速落地，并立即获得架构清晰度与开发效率的提升。

## 二、 总体设计：集中化三板斧

我们将通过引入三个核心模块，对现有架构进行收敛：

1.  **模型注册表 (Model Registry)**：创建一个 `lib/models/registry.ts` 文件，作为所有 AI 模型的唯一“户籍管理中心”，集中定义每个模型的 ID、名称、后端服务提供方（Provider）和对应的 BFF API 端点。
2.  **统一服务层 (Unified Service Layer)**：提供一个 `generateImage` 函数作为所有上层业务（如 Playground）调用 AI 生成能力的唯一入口。该函数负责根据模型 ID 查询注册表，处理参数合并，并调用相应的 BFF API。
3.  **预设配置中心 (Preset Configuration)**：建立一份 `lib/presets/presetsConfig.ts` 文件，用于结构化地管理可复用的生图预设（如“赛博朋克风格”、“电商主图海报”等），并将预设与特定模型关联。

> 💡 **核心思路**：将“用什么模型”、“怎么调”和“用什么参数”这三件事彻底解耦。上层业务只需关心“我要用哪个模型/预设”，而无需关心该模型背后是哪个 Provider、API 地址是什么、默认参数有哪些。

---

## 三、 核心组件设计与代码示例

以下是三大核心模块的具体代码实现。

### 3.1. 模型注册表 (`ModelRegistry`)

首先，我们定义模型配置的类型，并建立一个集中的注册表数组。

**路径**： `lib/models/types.ts`

```typescript
/**
 * @file lib/models/types.ts
 * @description 定义模型相关的核心类型
 */
export type Provider = "coze" | "ic_aip" | "comfy" | "google_genai" | "byte_artist";

export interface ModelConfig {
  /** 模型的唯一标识符，用于内部调用 */
  id: string;
  
  /** 在 UI 界面上向用户展示的名称 */
  displayName: string;
  
  /** 模型背后的服务提供方，用于返回结果的适配 */
  provider: Provider;
  
  /** 对应的 BFF (Backend-for-Frontend) 内部 API 路由 */
  endpoint: string;
  
  /** 模型的通用默认参数，优先级最低 */
  defaultParams?: Record<string, any>;
  
  /** 用于前端 UI 分类、筛选和展示的标签 */
  tags?: string[];
}
```

**路径**： `lib/models/registry.ts`

```typescript
/**
 * @file lib/models/registry.ts
 * @description 模型注册表，所有可用 AI 模型的唯一清单
 */
import { ModelConfig } from "./types";

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: "ic-aip-seed4.2-lemo",
    displayName: "智创网关 Seed 4.2 Lemo",
    provider: "ic_aip",
    endpoint: "/api/provider/ic-aip",
    defaultParams: {
      req_key: "seed4_2_lemo",
      img_return_type: "url"
    },
    tags: ["通用文生图", "写实"],
  },
  {
    id: "coze-workflow-lemo-poster",
    displayName: "Coze 工作流（Lemo 海报）",
    provider: "coze",
    endpoint: "/api/provider/coze",
    defaultParams: {
      workflow_id: "7570938708409663488",
    },
    tags: ["海报", "设计"],
  },
  {
    id: "google-gemini-pro-vision",
    displayName: "Gemini Pro Vision（图生文）",
    provider: "google_genai",
    endpoint: "/api/provider/google-genai",
    tags: ["图像理解", "图生文"],
  },
  // ... 此处继续添加其他模型，如 ComfyUI 工作流、ByteArtist 等
];

/**
 * 根据模型 ID 安全地获取其配置
 * @param modelId 模型唯一标识
 * @returns 对应的模型配置
 * @throws 如果模型 ID 未在注册表中找到
 */
export function getModelConfig(modelId: string): ModelConfig {
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`[ModelRegistry] 未知的模型 ID: "${modelId}"`);
  }
  return model;
}
```

### 3.2. 统一服务层 (`generateImage`)

这是上层业务调用的唯一入口，负责屏蔽所有底层复杂性。

**路径**： `lib/services/imageService.ts`

```typescript
/**
 * @file lib/services/imageService.ts
 * @description 统一的 AI 图像生成服务层
 */
import { getModelConfig, Provider } from "@/lib/models/registry";
import { PRESETS } from "@/lib/presets/presetsConfig";

export interface GenerateParams {
  modelId: string;
  prompt: string;
  images?: string[]; // 可选的输入图片，支持 URL 或 Base64
  presetId?: keyof typeof PRESETS;
  
  /**
   * 运行时覆盖参数，优先级最高。
   * 例如，用户在 UI 上临时调整了分辨率、种子等。
   */
  overrides?: Record<string, any>;
  
  /** 用于日志追踪和问题排查 */
  traceId?: string; 
}

export interface GenerateResult {
  images: string[]; // 标准化的图片结果数组（URL 或 Base64）
  raw?: any;       // 原始的、未经处理的 Provider 返回，供调试使用
  logId?: string;  // 从 Provider 返回中提取的日志 ID
}

export async function generateImage(params: GenerateParams): Promise<GenerateResult> {
  const { modelId, presetId, overrides, traceId, ...restParams } = params;
  const model = getModelConfig(modelId);

  // 1. 参数合并：优先级从低到高为 模型默认 -> 预设 -> 运行时参数 -> 运行时覆盖
  const presetModelParams = presetId ? PRESETS[presetId]?.models?.[modelId]?.params ?? {} : {};
  const finalPayload = {
    ...model.defaultParams,
    ...presetModelParams,
    ...restParams, // prompt, images 等
    ...overrides,
  };
  
  console.log(`[generateImage:${traceId}] - Request:`, { modelId, provider: model.provider, finalPayload });

  const startTime = Date.now();
  const response = await fetch(model.endpoint, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Trace-Id": traceId, // 将 traceId 传递给 BFF
    },
    body: JSON.stringify(finalPayload),
  });

  const duration = Date.now() - startTime;
  console.log(`[generateImage:${traceId}] - Response received in ${duration}ms, status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateImage:${traceId}] - Call to model "${modelId}" failed`, { status: response.status, error: errorText });
    throw new Error(`模型 ${model.displayName} 调用失败: ${errorText}`);
  }

  const data = await response.json();
  
  // 2. 统一返回结构
  const normalizedResult = normalizeProviderResponse(model.provider, data);
  console.log(`[generateImage:${traceId}] - Normalized result`, { imageCount: normalizedResult.images.length, logId: normalizedResult.logId });
  
  return normalizedResult;
}

/**
 * 将不同 Provider 的返回结果适配为统一的 GenerateResult 结构
 */
function normalizeProviderResponse(provider: Provider, data: any): GenerateResult {
  switch (provider) {
    case "ic_aip": {
      const result = data?.data?.results?.[0];
      const images = result?.pic_urls?.map((p: any) => p.main_url).filter(Boolean) ?? [];
      return { images, raw: data, logId: data?.extra?.log_id };
    }
    case "coze": {
      // 假设 Coze 直接返回图片 URL 列表或单个 URL
      const images = Array.isArray(data.image_urls) ? data.image_urls : (data.image_url ? [data.image_url] : []);
      return { images, raw: data, logId: data?.log_id };
    }
    case "google_genai": {
      // 假设 Gemini 返回 base64 列表
      return { images: data?.images ?? [], raw: data, logId: data?.log_id };
    }
    default:
      console.warn(`[normalizeProviderResponse] Unknown provider: ${provider}, returning raw data.`);
      return { images: [], raw: data };
  }
}
```

### 3.3. 预设配置中心 (`presetsConfig`)

一个简单的、类型安全的对象，用于定义所有可复用的预设。

**路径**： `lib/presets/presetsConfig.ts`

```typescript
/**
 * @file lib/presets/presetsConfig.ts
 * @description 集中管理所有生图预设
 */
export const PRESETS = {
  // 通用场景
  "general-default": {
    name: "默认配置",
    description: "适用于多种场景的通用高质量出图配置。",
    models: {
      "ic-aip-seed4.2-lemo": {
        params: {
          quality: "hd",
          style: "natural",
        },
      },
    },
  },
  
  // 特定风格场景
  "style-cyberpunk": {
    name: "赛博朋克风",
    description: "生成具有未来感、霓虹灯效的赛博朋克风格图像。",
    models: {
      "ic-aip-seed4.2-lemo": {
        params: {
          style: "cyberpunk",
          art_style: "strong",
        },
      },
      "coze-workflow-lemo-poster": {
        params: {
          prompt_suffix: ", cyberpunk, neon lights, futuristic city",
        },
      },
    },
  },

  // 特定业务场景
  "e-commerce-poster": {
    name: "电商主图海报",
    description: "为电商产品生成高吸引力的主图或海报。",
    models: {
      "ic-aip-seed4.2-lemo": {
        params: {
          aspect_ratio: "3:4",
          composition: "product_shot",
          lighting: "studio",
        },
      },
    },
  },
} as const; // 使用 as const 实现类型推断，让 presetId 成为安全的联合类型

export type PresetId = keyof typeof PRESETS;
```

### 3.4. 统一 API Route (可选但推荐)

虽然 `generateImage` 也可以直接在前端调用（此时 fetch 的是 `/api/provider/*`），但增加一层统一的 API Route 可以带来额外的好处，如统一的错误处理、日志和未来的权限控制。

**路径**： `app/api/generate/route.ts`

```typescript
/**
 * @file app/api/generate/route.ts
 * @description BFF 的统一生成入口，解耦前端与底层 Provider API
 */
import { NextRequest, NextResponse } from "next/server";
import { generateImage, GenerateParams } from "@/lib/services/imageService";
import { randomUUID } from "crypto"; // Node.js 16+

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("X-Request-Id") || randomUUID();
  
  try {
    const body: GenerateParams = await req.json();
  
    // 从 BFF 调用统一服务层
    const result = await generateImage({ ...body, traceId });
  
    return NextResponse.json({ code: 0, message: "success", data: result });
  } catch (error: any) {
    console.error(`[API /generate:${traceId}] - Error:`, error);
    return NextResponse.json(
      { code: 500, message: error.message || "内部服务器错误" },
      { status: 500 }
    );
  }
}
```

---

## 四、 调用方式与规范

### 4.1. 上层统一调用

经过改造后，所有前端业务（如 Playground）的调用逻辑将极大简化。原先复杂的 `if-else` 分支将不复存在，统一收敛为对 `generateImage` 的调用。

**旧代码 (示意)**:

```typescript
// pages/playground-v2.tsx (改造前)
const handleGenerate = async () => {
  if (selectedModel === "智创网关 Seed") {
    // 调用智创网关的 fetch...
    const res = await fetch("/api/provider/ic-aip", { /* ... */ });
    const data = await res.json();
    setImages(data.data.results[0].pic_urls.map(p => p.main_url));
  } else if (selectedModel === "Coze 工作流") {
    // 调用 Coze 的 fetch...
    const res = await fetch("/api/provider/coze", { /* ... */ });
    const data = await res.json();
    setImages([data.image_url]);
  }
  // ... 更多分支
}
```

**新代码 (示意)**:

```typescript
// pages/playground-v2.tsx (改造后)
import { generateImage } from "@/lib/services/imageService"; // 或从统一 API fetch

const handleGenerate = async () => {
  setLoading(true);
  try {
    const result = await generateImage({ // 或 fetch('/api/generate', ...)
      modelId: selectedModelId, // "ic-aip-seed4.2-lemo"
      presetId: selectedPresetId, // "style-cyberpunk"
      prompt: currentPrompt,
      overrides: { // 用户在 UI 上临时调整的参数
        seed: 12345,
        width: 1024,
      },
    });
    setImages(result.images);
  } catch (error) {
    console.error(error);
    // toast.error(...)
  } finally {
    setLoading(false);
  }
}
```

### 4.2. 配置合并策略

参数的最终生效遵循一个清晰的覆盖逻辑，优先级从低到高：

1. **模型默认参数 (`ModelConfig.defaultParams`)**：定义在模型注册表中的基础配置，是保底选项。
2. **预设参数 (`PRESETS[presetId].models[modelId].params`)**：用户选择的预设所带的参数，会覆盖模型默认参数。
3. **运行时核心参数 (`GenerateParams`)**：如 `prompt`、`images` 等核心输入，直接传递。
4. **运行时覆盖参数 (`GenerateParams.overrides`)**：用户在 UI 上临时调整的参数，具有最高优先级，会覆盖上述所有同名参数。

这种分层策略保证了灵活性和可维护性的平衡。

### 4.3. 返回结构规范化

`generateImage` 函数的核心职责之一就是“抹平差异”。无论底层 Provider 返回的 `data` 结构多么复杂，`normalizeProviderResponse` 函数都会将其处理成统一的 `GenerateResult` 格式。

这意味着，上层业务拿到的永远是一个结构稳定、字段清晰的对象，从而彻底将 UI 展示逻辑与底层数据结构解耦。

---

## 五、 小而高效的增强点

在完成上述核心重构的基础上，我们可以轻松地加入几个投入产出比极高的优化点。

1. **短期请求缓存**：在统一的 Provider API 层（如 `/api/provider/ic-aip/route.ts`），可以针对不包含随机性的纯文本生成请求，增加一个基于内存的短期缓存（如 `node-cache`）。

   ```typescript
   // app/api/provider/ic-aip/route.ts (示意)
   import NodeCache from "node-cache";
   const reqCache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存

   export async function POST(req: NextRequest) {
     const body = await req.json();
     const cacheKey = JSON.stringify(body);

     if (reqCache.has(cacheKey)) {
       return NextResponse.json(reqCache.get(cacheKey));
     }

     // ... (原有的调用逻辑)

     reqCache.set(cacheKey, result);
     return NextResponse.json(result);
   }
   ```

   > 💭 此举可有效避免用户因网络波动或误操作导致的重复点击，从而节省不必要的 AI 计算成本。
   >
2. **统一日志与追踪**：利用 `generateImage` 这个唯一入口，我们可以轻松实现标准化的日志记录。如前文代码所示，通过 `traceId` 贯穿整个调用链路，并记录关键信息（模型、耗时、结果等），将极大地简化未来的问题排查。
3. **Zod 配置校验**：
   引入 `Zod` 库对 `MODEL_REGISTRY` 和 `PRESETS` 进行启动时校验，可以有效防止因手动修改配置（如拼写错误、类型不匹配）而导致的运行时 Bug。

   ```typescript
   // lib/models/types.ts (使用 Zod)
   import { z } from "zod";

   export const ModelConfigSchema = z.object({
     id: z.string().min(1),
     displayName: z.string(),
     provider: z.enum(["coze", "ic_aip", "comfy", "google_genai", "byte_artist"]),
     // ... 其他字段
   });

   // 在 registry.ts 中
   ModelConfigSchema.array().parse(MODEL_REGISTRY); // 校验整个注册表
   ```

---

## 六、 仓库版本更新补充项

随着项目依赖（如 Next.js）的升级和架构的演进，我们需要关注一些关键的适配点，以确保新架构能够平稳运行。假设项目已升级至 **Next.js 14/15 App Router**，并使用 **ESM** 模块系统。

### 适配项与检查清单

- **API Route Runtime 差异**：

  - **现状确认**：检查现有的 API Routes (`/api/provider/*`) 是否被配置为 `edge` runtime。
  - **适配动作**：
    - 如果 Provider 的 SDK 或依赖（如 `crypto` 签名）需要在 Node.js 环境运行，必须确保对应的 API Route **未**声明 `export const runtime = 'edge'`，或显式声明为 `nodejs`。
    - 对于需要处理流式响应（SSE）的 BFF 接口（如 `/api/generate` 的流式版本），使用 `ReadableStream` 和 `TextEncoderStream` 是标准做法，这在 Edge 和 Node.js runtime 下均表现良好。
- **环境变量与密钥安全**：

  - **现状确认**：检查 `GOOGLE_GENAI_API_KEY`、`APP_SECRET` 等敏感密钥是否仅通过 `process.env` 在服务端代码（API Routes, `lib/services/*`）中访问。
  - **适配动作**：
    - **严禁**任何以 `NEXT_PUBLIC_` 为前缀的环境变量用于存储密钥，这会导致密钥泄露到客户端。
    - 在 `generateImage` 服务和所有 Provider API 中，确认密钥获取逻辑严格限制在服务端。
- **Provider 端路由收敛与错误归一化**：

  - **现状确认**：检查 `/api/provider/*` 接口的错误处理逻辑是否五花八门。
  - **适配动作**：
    - 为所有 Provider API 建立一个统一的错误处理中间件或高阶函数，将底层的 `try-catch` 逻辑封装起来。
    - 将不同 Provider 的错误（如签名失败、配额超限、模型执行错误）映射为统一的、包含 `code` 和 `message` 的错误响应体，方便上层 `generateImage` 服务进行一致性处理。
- **UI 模型选择控件渲染**：

  - **现状确认**：检查 Playground 的模型下拉框数据源。
  - **适配动作**：
    - 改造 `BaseModelSelectorDialog` 或类似的 UI 组件，使其数据源**唯一**来自 `MODEL_REGISTRY`。
    - 可以通过一个 `/api/models` 接口将注册表信息暴露给前端，或在 RSC (React Server Component) 中直接导入并传递给客户端组件。
- **追踪字段 (logid/traceId) 贯穿**：

  - **现状确认**：检查错误日志是否缺乏上下文，难以关联。
  - **适配动作**：
    - 在 BFF 的入口（如 `/api/generate`）生成一个 `traceId`。
    - 将 `traceId` 通过日志、`GenerateParams` 一路透传到 `generateImage` 服务和各个 Provider API。
    - 在 `normalizeProviderResponse` 中，尝试从 Provider 的返回体中提取其自身的 `logId`，并与 `traceId` 一并记录。
- **预设变更流程与审计**：

  - **现状确认**：目前预设直接在代码中修改，缺乏记录。
  - **适配动作**：
    - 短期内，将 `presetsConfig.ts` 的变更纳入 Code Review 的重点关注项。
    - 长期看，可将预设配置迁移到外部配置中心（如飞书多维表格、内部配置系统），并通过 API 动态加载，从而实现非代码化的预设管理和审计。

---

## 七、 落地步骤与验收标准

本方案设计为可渐进式实施，预计可在 1-2 周内完成核心改造。

### 落地步骤

1. **Week 1, Day 1-2: 核心模块搭建**

   - [ ] 创建 `lib/models/types.ts` 和 `lib/models/registry.ts`，将至少 2-3 个核心模型（如智创网关、Coze）的配置迁移进来。
   - [ ] 创建 `lib/presets/presetsConfig.ts`，定义 2-3 个常用预设。
   - [ ] 创建 `lib/services/imageService.ts`，实现 `generateImage` 函数的骨架，完成参数合并逻辑和对一个 Provider 的调用和返回适配。
2. **Week 1, Day 3-4: 逐个适配 Provider**

   - [ ] 保持现有的 `/api/provider/*` 接口不变，在 `generateImage` 中逐个完成对它们的调用和 `normalizeProviderResponse` 适配。
   - [ ] 编写单元测试或集成测试，确保 `generateImage` 对每个模型的调用结果符合预期。
3. **Week 1, Day 5: 改造上层调用**

   - [ ] 改造 `PlaygroundV2` 页面，将其模型选择器数据源切换为 `MODEL_REGISTRY`。
   - [ ] 将其核心生成逻辑替换为对 `generateImage` 的统一调用。
   - [ ] 联调端到端链路，确保 Playground 功能正常。
4. **Week 2: 增强与收尾**

   - [ ] 实施“小而高效的增强点”：加入日志、缓存和 Zod 校验。
   - [ ] 根据“仓库版本更新补充项”清单，逐一检查并完成适配。
   - [ ] 整理代码，补充注释，提交 Code Review。

### 验收标准

- **功能对齐**：改造后的所有模型生成功能与改造前保持一致，无功能退化。
- **代码收敛**：`PlaygroundV2` 或其他业务方的模型调用逻辑被成功收敛到对 `generateImage` 的单一调用。
- **配置集中**：所有模型和预设的定义均已迁移到对应的 `registry.ts` 和 `presetsConfig.ts` 文件中。
- **可扩展性验证**：能够通过仅修改 `registry.ts` 和 `presetsConfig.ts`（不改动业务代码）来新增/修改一个模型或预设，并立即在 UI 上生效。
- **日志与排障**：在调用链路中，能够通过 `traceId` 查看到包含模型、耗时、结果等信息的标准化日志。

---

## 八、 上线前 Checklist

- [ ] **代码审查**：核心模块（`registry`, `imageService`, `presets`）经过团队 CR，设计与实现达成共识。
- [ ] **配置核对**：生产环境的 `MODEL_REGISTRY` 中，所有模型的 `endpoint` 和 `defaultParams` 均已确认为正确值。
- [ ] **环境变量**：确认部署环境中所有必需的密钥（`APP_SECRET` 等）已正确配置，且遵循了 `NEXT_PUBLIC_` 安全规范。
- [ ] **回归测试**：对所有支持的模型和核心预设都执行一遍端到端测试用例，确保功能正常。
- [ ] **性能测试**：对统一生成接口 `/api/generate` 进行简单的压力测试，评估其在高并发下的响应时间和资源消耗。
- [ ] **监控与告警**：为 `/api/generate` 接口的关键错误（如 5xx 错误率、调用超时）配置基本的监控和告警。
- [ ] **回滚预案**：准备好可快速回滚到旧架构的 Git 分支或部署版本，以应对不可预见的问题。

```

```
