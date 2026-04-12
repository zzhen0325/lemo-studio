import type { PlaygroundShortcut, ShortcutPromptValues } from "@/config/moodboard-cards";
import type { Generation, GenerationConfig } from "@/types/database";
import type {
  DesignStructuredAnalysis,
  DesignStructuredPaletteEntry,
  DesignStructuredSourceType,
  DesignVariantEditScope,
  KvStructuredVariantId,
} from "@/app/studio/playground/_lib/kv-structured-optimization";
import {
  isPersistedPromptOptimizationSourceKind,
  type PersistedPromptOptimizationSourceKind,
} from "@/lib/ai/prompt-flow-taxonomy";
import { isHistoryEditGeneration } from "@/app/studio/playground/_lib/history-tags";

export const PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE = "prompt_optimization";
export const IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE = "image_description";
export const PROMPT_OPTIMIZATION_VARIANT_COUNT = 4;

export type PromptHistoryRecordType =
  | "generation"
  | typeof PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE
  | typeof IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE;

// This persisted source kind describes the business-side optimization origin only.
// It must not be confused with the lower-level execution context `service:optimize`.
export type PromptOptimizationSourceKind = PersistedPromptOptimizationSourceKind;
export type PromptHistoryPromptRestoreMode = "plain" | "kv_structured" | "shortcut_inline";

export type GalleryPromptCategory =
  | "standard_generation"
  | "optimized_generation"
  | "prompt_optimization"
  | "image_description"
  | "edit_generation"
  | "banner_generation"
  | "workflow_generation";

export const GALLERY_PROMPT_CATEGORY_LABELS: Record<GalleryPromptCategory, string> = {
  standard_generation: "普通生成",
  optimized_generation: "优化生成",
  prompt_optimization: "提示词优化",
  image_description: "图像描述",
  edit_generation: "编辑生成",
  banner_generation: "Banner",
  workflow_generation: "工作流",
};

export interface SerializedShortcutOptimizationVariantBaseline {
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
}

export interface SerializedShortcutOptimizationVariant {
  id: KvStructuredVariantId;
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
  baseline: SerializedShortcutOptimizationVariantBaseline;
  pendingInstruction: string;
  pendingScope: DesignVariantEditScope;
  isModifying: boolean;
}

export interface SerializedShortcutOptimizationSession {
  sourceType: DesignStructuredSourceType;
  originValues: ShortcutPromptValues;
  originRemovedFieldIds: string[];
  activeVariantId: KvStructuredVariantId;
  variants: SerializedShortcutOptimizationVariant[];
  lastRawResponse: string;
}

export interface PromptOptimizationSourcePayload {
  version: 2;
  sourceKind: PromptOptimizationSourceKind;
  taskId: string;
  originalPrompt: string;
  activeVariantId: string;
  activeVariantLabel: string;
  shortcutId?: PlaygroundShortcut["id"];
  session?: SerializedShortcutOptimizationSession;
}

export interface PromptOptimizationVariantDraftInput {
  id: string;
  label: string;
  prompt: string;
}

interface BuildPromptOptimizationHistoryItemsParams {
  taskId: string;
  createdAt: string;
  userId: string;
  originalPrompt: string;
  sourceKind: PromptOptimizationSourceKind;
  variants: PromptOptimizationVariantDraftInput[];
  configBase: Pick<GenerationConfig, "model" | "width" | "height"> & Partial<GenerationConfig>;
  maxItems?: number;
  shortcutId?: PlaygroundShortcut["id"];
  session?: SerializedShortcutOptimizationSession;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function getPromptHistoryRecordType(
  config?: GenerationConfig | Record<string, unknown> | null,
): PromptHistoryRecordType {
  const recordType = asString(asRecord(config)?.historyRecordType);

  if (recordType === PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE) {
    return PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE;
  }
  if (recordType === IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE) {
    return IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE;
  }
  return "generation";
}

export function getPromptOptimizationSource(
  config?: GenerationConfig | Record<string, unknown> | null,
): PromptOptimizationSourcePayload | null {
  const payload = asRecord(asRecord(config)?.optimizationSource);
  if (!payload) {
    return null;
  }

  const version = payload.version;
  const sourceKind = asString(payload.sourceKind);
  const taskId = asString(payload.taskId);
  const originalPrompt = asString(payload.originalPrompt);
  const activeVariantId = asString(payload.activeVariantId);
  const activeVariantLabel = asString(payload.activeVariantLabel);

  if (
    version !== 2
    || !sourceKind
    || !isPersistedPromptOptimizationSourceKind(sourceKind)
    || !taskId
    || !originalPrompt
    || !activeVariantId
    || !activeVariantLabel
  ) {
    return null;
  }

  const shortcutId = asString(payload.shortcutId) as PlaygroundShortcut["id"] | null;
  const session = payload.session as SerializedShortcutOptimizationSession | undefined;

  return {
    version: 2,
    sourceKind,
    taskId,
    originalPrompt,
    activeVariantId,
    activeVariantLabel,
    shortcutId: shortcutId || undefined,
    session,
  };
}

export function getPromptHistoryPromptRestoreMode(
  config?: GenerationConfig | Record<string, unknown> | null,
): PromptHistoryPromptRestoreMode {
  const source = getPromptOptimizationSource(config);
  if (
    getPromptHistoryRecordType(config) !== PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE
    || !source
  ) {
    return "plain";
  }

  if (
    source.sourceKind === "kv_structured"
    && source.shortcutId
    && source.session
  ) {
    return "kv_structured";
  }

  if (
    source.sourceKind === "shortcut_inline"
    && source.shortcutId
  ) {
    return "shortcut_inline";
  }

  return "plain";
}

export function getGalleryPromptCategory(
  config?: GenerationConfig | Record<string, unknown> | null,
): GalleryPromptCategory {
  const recordType = getPromptHistoryRecordType(config);

  if (recordType === PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE) {
    return "prompt_optimization";
  }

  if (recordType === IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE) {
    return "image_description";
  }

  // `optimized_generation` means a normal generation result reused an optimized prompt.
  // It is not itself a `prompt_optimization` history record.
  if (getPromptOptimizationSource(config)) {
    return "optimized_generation";
  }

  const record = asRecord(config);
  if (record?.generationMode === "banner") {
    return "banner_generation";
  }
  if (isHistoryEditGeneration(record)) {
    return "edit_generation";
  }
  if (asString(record?.workflowName)) {
    return "workflow_generation";
  }

  return "standard_generation";
}

export function getGalleryPromptCategoryLabel(
  category: GalleryPromptCategory,
): string {
  return GALLERY_PROMPT_CATEGORY_LABELS[category];
}

export function shouldShowInGalleryImageWall(
  item: Pick<Generation, "outputUrl" | "config">,
): boolean {
  if (!item.outputUrl) {
    return false;
  }

  const category = getGalleryPromptCategory(item.config);
  return category !== "prompt_optimization" && category !== "image_description";
}

export function getPromptCardThumbnailSource(
  item: Pick<Generation, "config">,
): string | null {
  const sourceImageUrls = item.config?.sourceImageUrls;
  if (!Array.isArray(sourceImageUrls) || sourceImageUrls.length === 0) {
    return null;
  }

  const firstSourceUrl = sourceImageUrls[0];
  if (typeof firstSourceUrl !== "string" || firstSourceUrl.trim().length === 0) {
    return null;
  }

  return firstSourceUrl;
}

export function isPromptOptimizationHistoryItem(result: Generation): boolean {
  return getPromptHistoryRecordType(result.config) === PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE;
}

export function isImageDescriptionHistoryItem(result: Generation): boolean {
  return getPromptHistoryRecordType(result.config) === IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE;
}

export function getOptimizationVariantOrder(result: Generation): number {
  const payload = getPromptOptimizationSource(result.config);
  if (!payload) {
    return Number.MAX_SAFE_INTEGER;
  }

  const sessionVariantIndex = payload.session?.variants.findIndex(
    (variant) => variant.id === payload.activeVariantId,
  );

  if (typeof sessionVariantIndex === "number" && sessionVariantIndex >= 0) {
    return sessionVariantIndex;
  }

  const numericSuffix = Number(payload.activeVariantId.replace(/[^\d]/g, ""));
  return Number.isFinite(numericSuffix) && numericSuffix > 0
    ? numericSuffix - 1
    : Number.MAX_SAFE_INTEGER;
}

export function createPromptOptimizationHistoryItems(
  params: BuildPromptOptimizationHistoryItemsParams,
): Generation[] {
  const {
    taskId,
    createdAt,
    userId,
    originalPrompt,
    sourceKind,
    variants,
    configBase,
    maxItems,
    shortcutId,
    session,
  } = params;

  const normalizedMaxItems = Number.isFinite(maxItems)
    ? Math.max(1, Math.floor(maxItems as number))
    : PROMPT_OPTIMIZATION_VARIANT_COUNT;

  return variants.slice(0, normalizedMaxItems).map((variant, index) => {
    const optimizationSource: PromptOptimizationSourcePayload = {
      version: 2,
      sourceKind,
      taskId,
      originalPrompt,
      activeVariantId: variant.id,
      activeVariantLabel: variant.label,
      shortcutId,
      session,
    };

    return {
      id: `prompt-opt-${taskId}-${variant.id}-${index}`,
      userId,
      projectId: "default",
      outputUrl: "",
      config: {
        ...configBase,
        prompt: variant.prompt,
        taskId,
        historyRecordType: PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE,
        promptCategory: "prompt_optimization",
        optimizationSource,
      },
      status: "completed",
      createdAt,
    };
  });
}

export function withPromptOptimizationSource(
  config: GenerationConfig,
  payload: PromptOptimizationSourcePayload,
  promptCategory: GalleryPromptCategory = "optimized_generation",
): GenerationConfig {
  const sanitized = withoutPromptOptimizationSource(config);
  return {
    ...sanitized,
    promptCategory,
    optimizationSource: payload,
  };
}

export function withoutPromptOptimizationSource(
  config: GenerationConfig,
): GenerationConfig {
  const nextConfig = { ...config };
  delete nextConfig.optimizationSource;

  if (
    nextConfig.promptCategory === "optimized_generation"
    || nextConfig.promptCategory === "prompt_optimization"
    || nextConfig.promptCategory === "image_description"
  ) {
    delete nextConfig.promptCategory;
  }

  if (
    nextConfig.historyRecordType === PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE
    || nextConfig.historyRecordType === IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE
  ) {
    delete nextConfig.historyRecordType;
  }

  return nextConfig;
}
