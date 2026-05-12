# Adapter Contract (Project-Pinned)

These interfaces remain as internal contracts, and this skill uses fixed upstream endpoints and model IDs.

## Fixed Endpoint Binding

- Optimize: `POST ${LEMO_COZE_PROMPT_RUN_URL}`, model binding `coze-prompt`
- Seedream generate: `POST ${LEMO_COZE_SEED_RUN_URL}`, model binding `coze_seedream4_5`
- Lemo generate: `POST ${GATEWAY_BASE_URL}/media/api/pic/submit_task_v2` + `batch_get_result_v2`, model binding `seed4_0407_lemo`

## Core Interfaces

```ts
interface KvOptimizeAdapter {
  optimize(input: KvOptimizeInput): Promise<KvOptimizeResult>;
}

interface ImageGenAdapter {
  generate(input: ImageGenInput): Promise<ImageGenResult>;
}

interface SizeAdaptAdapter {
  adapt(input: SizeAdaptInput): Promise<SizeAdaptResult>;
}

interface SessionAdapter {
  save(state: KvSessionState): Promise<string>;
  load(sessionId: string): Promise<KvSessionState | null>;
}
```

## Data Shapes

```ts
type Market = "US" | "SEA" | "JP";
type GenerationMethod = "regenerated" | "fallback_adapted";

type KvCoreFields = {
  mainTitle: string;
  subTitle: string;
  eventTime: string;
  heroSubject: string;
  style: string;
  primaryColor: string;
};

type KvOptimizeInput = {
  market: Market;
  coreFields: KvCoreFields;
  userIntent: string;
  constraints?: Record<string, unknown>;
};

type KvOptimizeResult = {
  variantId: string;
  variantLabel: string;
  promptPreview: string;
  narrativeBlocks: {
    canvas: string;
    subject: string;
    background: string;
    layout: string;
    typography: string;
  };
  editableTokens: {
    canvasTokens: string[];
    subjectTokens: string[];
    backgroundTokens: string[];
    layoutTokens: string[];
    typographyTokens: string[];
  };
  metadata?: Record<string, unknown>;
};

type ImageGenInput = {
  modelId: "coze_seedream4_5" | "seed4_0407_lemo";
  prompt: string;
  width: number;
  height: number;
  references?: string[];
  options?: Record<string, unknown>;
};

type ImageGenResult = {
  images: string[];
  metadata?: Record<string, unknown>;
};

type SizeAdaptInput = {
  masterImageUrl: string;
  targetWidth: number;
  targetHeight: number;
  safeRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  policy?: "subject-first" | "contain-pad";
};

type SizeAdaptResult = {
  imageUrl: string;
  metadata?: Record<string, unknown>;
};

type KvSessionState = {
  sessionId: string;
  market: Market;
  coreFields: KvCoreFields;
  activeVariantId: string;
  promptPreview: string;
  outputs: Array<{
    width: number;
    height: number;
    imageUrl: string;
    method: GenerationMethod;
  }>;
  metadata?: Record<string, unknown>;
};

type KvNaturalLanguageResponse = {
  summary: string;
  fieldRecap: string;
  sizeLines: string[];
  nextActionHint: string;
};
```

## Behavioral Guarantees

- `KvOptimizeAdapter.optimize` must return at least one usable variant.
- `ImageGenAdapter.generate` should throw explicit model/size errors for policy routing.
- `SizeAdaptAdapter.adapt` should be deterministic for identical inputs.
- `SessionAdapter` should persist full editable context to support iterative refinement.
- User-facing output should be rendered as natural language (`KvNaturalLanguageResponse`), not raw JSON payloads.
