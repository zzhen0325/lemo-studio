## 范围限制
- 仅改动与“生成流程”和“历史列表”相关的类型与代码。
- 预设（Preset）与风格（Style/StyleStack）保持现状，不做改动。

## 文件与改动点
1) components/features/playground-v2/types.ts
- 保留现有 GenerationConfig（UI 层仍使用 img_width/img_height/base_model/image_size）。
- 新增并导出统一类型：
  - 从 /types/database.ts 引入 Generation、GenerationConfig（命名为 UGeneration、UGenerationConfig 以示区分）。
  - 定义 ViewGeneration = UGeneration & { isLoading?: boolean; savedPath?: string }，替换旧的 GenerationResult 用于历史与生成结果展示。
- 将项目中引用 GenerationResult 的地方改为引用 ViewGeneration。

2) lib/store/playground-store.ts
- generationHistory 类型改为 ViewGeneration[]。
- fetchHistory：保持调用 /api/history 不变；增加映射逻辑把旧返回（imageUrl、metadata.img_width 等）转为 ViewGeneration（统一字段），用于前端展示。
- 其他与配置 UI（img_width/img_height/base_model）的逻辑保持不变，避免波及预设与风格。

3) hooks/features/PlaygroundV2/useGenerationService.ts
- 生成入口：从 store 读取“旧 UI 配置”（img_width/img_height/base_model/image_size），借助适配层将其转换为 UGenerationConfig：
  - Nano banana：按 aspectRatio+resolution 推导 width/height；不支持自定义尺寸则走 ratioResolution 路径。
  - 其他模型：直接使用 UI 的 img_width/img_height → width/height。
- 结果入历史：构造 ViewGeneration（统一字段），前端展示使用统一类型；向旧 /api/history 写入时通过适配层反向映射为旧字段形态，保持兼容。

4) 适配层（已完成）
- 使用 lib/adapters/data-mapping.ts：
  - deriveSize、inferRatioResolution：比例/分辨率与宽高的双向推导。
  - toUnifiedConfigFromLegacy：把 UI 的旧配置映射为 UGenerationConfig。

## 示例代码片段
- 在 types.ts 引入统一类型并定义 ViewGeneration：
```ts
import { Generation as UGeneration, GenerationConfig as UGenerationConfig } from '@/types/database';
export interface ViewGeneration extends UGeneration { isLoading?: boolean; savedPath?: string }
```
- 在 store 中使用 ViewGeneration：
```ts
// generationHistory: ViewGeneration[]
// fetchHistory: 将 /api/history 的旧字段映射为 ViewGeneration
```
- 在生成服务中转换配置：
```ts
import { toUnifiedConfigFromLegacy } from '@/lib/adapters/data-mapping';
const unified = toUnifiedConfigFromLegacy(legacyConfigFromStore);
// 按 unified.width/unified.height 调用模型 API
```

## 验收标准
- TS 编译通过，替换后不出现 any 或未定义类型。
- 历史列表正常展示，字段统一（outputUrl、prompt、width/height 等）。
- 生成流程正常：Nano banana 与其他模型均可生成；生成中的 isLoading 状态与保存路径 savedPath 正常工作。
- /api/history 接口保持兼容，无“幽灵数据”新增。

## 风险与控制
- 仅改动生成与历史相关类型，避免影响预设与风格；UI 配置字段暂不重命名，降低波及面。
- 所有旧→新映射在适配层完成，后续扩展（Firestore）时可复用。