import {
  buildShortcutPrompt,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from "@/config/moodboard-cards";
import type { ShortcutEditorDocument } from "@/app/studio/playground/_lib/shortcut-editor-document";
import {
  assembleDesignStructuredShortcutPrompt,
  derivePaletteFromVariantContent,
  KV_CORE_FIELD_IDS,
  KV_STRUCTURED_VARIANT_IDS,
  parseDesignStructuredOptimizationResponse,
  replaceHexColorReferences,
  replacePaletteWeightReferences,
  type DesignStructuredAnalysis,
  type DesignStructuredPaletteEntry,
  type DesignStructuredSourceType,
  type DesignVariantEditScope,
  type KvCoreFieldId,
  type KvStructuredVariantId,
} from "@/app/studio/playground/_lib/kv-structured-optimization";
import type {
  PromptOptimizationSourcePayload,
  SerializedShortcutOptimizationSession,
} from "@/app/studio/playground/_lib/prompt-history";

export interface ShortcutOptimizationVariantBaseline {
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
}

export interface ShortcutOptimizationVariantDraft {
  id: KvStructuredVariantId;
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
  baseline: ShortcutOptimizationVariantBaseline;
  pendingInstruction: string;
  pendingScope: DesignVariantEditScope;
  isModifying: boolean;
}

export interface ShortcutOptimizationSession {
  sourceType: DesignStructuredSourceType;
  originValues: ShortcutPromptValues;
  originRemovedFieldIds: string[];
  activeVariantId: KvStructuredVariantId;
  variants: ShortcutOptimizationVariantDraft[];
  lastRawResponse: string;
}

export interface ActiveShortcutTemplate {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  appliedPrompt: string;
  editorDocument?: ShortcutEditorDocument;
  optimizationSession?: ShortcutOptimizationSession;
}

export function cloneShortcutValues(values: ShortcutPromptValues): ShortcutPromptValues {
  return { ...values };
}

export function cloneDesignPalette(palette: DesignStructuredPaletteEntry[]) {
  return palette.map((entry) => ({ ...entry }));
}

export function cloneDesignAnalysis(analysis: DesignStructuredAnalysis): DesignStructuredAnalysis {
  return {
    canvas: { tokens: [...analysis.canvas.tokens], detailText: analysis.canvas.detailText },
    subject: { tokens: [...analysis.subject.tokens], detailText: analysis.subject.detailText },
    background: { tokens: [...analysis.background.tokens], detailText: analysis.background.detailText },
    layout: { tokens: [...analysis.layout.tokens], detailText: analysis.layout.detailText },
    typography: { tokens: [...analysis.typography.tokens], detailText: analysis.typography.detailText },
  };
}

export function createEmptyCoreSuggestionValues(): ShortcutPromptValues {
  return KV_CORE_FIELD_IDS.reduce<ShortcutPromptValues>((acc, fieldId) => {
    acc[fieldId] = "";
    return acc;
  }, {});
}

export function cloneVariantBaseline(baseline: ShortcutOptimizationVariantBaseline): ShortcutOptimizationVariantBaseline {
  return {
    label: baseline.label,
    values: cloneShortcutValues(baseline.values),
    removedFieldIds: [...baseline.removedFieldIds],
    coreSuggestions: cloneShortcutValues(baseline.coreSuggestions),
    palette: cloneDesignPalette(baseline.palette),
    analysis: cloneDesignAnalysis(baseline.analysis),
    promptPreview: baseline.promptPreview,
  };
}

export function mergeLockedKvValues(
  baseValues: ShortcutPromptValues,
  candidateValues: Partial<Record<KvCoreFieldId, string>>,
): ShortcutPromptValues {
  const nextValues = cloneShortcutValues(baseValues);

  KV_CORE_FIELD_IDS.forEach((fieldId) => {
    const currentValue = (baseValues[fieldId] || "").trim();
    const candidateValue = (candidateValues[fieldId] || "").trim();
    nextValues[fieldId] = currentValue || candidateValue || "";
  });

  return nextValues;
}

export function findShortcutVariant(
  session: ShortcutOptimizationSession,
  variantId: KvStructuredVariantId,
) {
  return session.variants.find((variant) => variant.id === variantId);
}

export function serializeShortcutOptimizationSession(
  session: ShortcutOptimizationSession,
): SerializedShortcutOptimizationSession {
  return {
    sourceType: session.sourceType,
    originValues: { ...session.originValues },
    originRemovedFieldIds: [...session.originRemovedFieldIds],
    activeVariantId: session.activeVariantId,
    variants: session.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      values: { ...variant.values },
      removedFieldIds: [...variant.removedFieldIds],
      coreSuggestions: { ...variant.coreSuggestions },
      palette: variant.palette.map((entry) => ({ ...entry })),
      analysis: cloneDesignAnalysis(variant.analysis),
      promptPreview: variant.promptPreview,
      baseline: {
        label: variant.baseline.label,
        values: { ...variant.baseline.values },
        removedFieldIds: [...variant.baseline.removedFieldIds],
        coreSuggestions: { ...variant.baseline.coreSuggestions },
        palette: variant.baseline.palette.map((entry) => ({ ...entry })),
        analysis: cloneDesignAnalysis(variant.baseline.analysis),
        promptPreview: variant.baseline.promptPreview,
      },
      pendingInstruction: variant.pendingInstruction,
      pendingScope: variant.pendingScope,
      isModifying: variant.isModifying,
    })),
    lastRawResponse: session.lastRawResponse,
  };
}

export function buildStructuredOptimizationSourcePayload(
  template: ActiveShortcutTemplate | null,
  taskId: string,
  variantId?: KvStructuredVariantId,
): PromptOptimizationSourcePayload | null {
  if (!template?.optimizationSession) {
    return null;
  }

  const activeVariantId = variantId || template.optimizationSession.activeVariantId;
  const activeVariant = findShortcutVariant(template.optimizationSession, activeVariantId);
  if (!activeVariant) {
    return null;
  }

  const originalPrompt = buildShortcutPrompt(
    template.shortcut,
    template.optimizationSession.originValues,
    {
      usePlaceholder: false,
      removedFieldIds: template.optimizationSession.originRemovedFieldIds,
    },
  );

  return {
    version: 1,
    sourceKind: "kv_structured",
    taskId,
    originalPrompt,
    activeVariantId: activeVariant.id,
    activeVariantLabel: activeVariant.label,
    shortcutId: template.shortcut.id,
    session: serializeShortcutOptimizationSession(template.optimizationSession),
  };
}

export function hydrateShortcutOptimizationSession(
  session: SerializedShortcutOptimizationSession,
): ShortcutOptimizationSession {
  return {
    sourceType: session.sourceType,
    originValues: { ...session.originValues },
    originRemovedFieldIds: [...session.originRemovedFieldIds],
    activeVariantId: session.activeVariantId,
    variants: session.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      values: { ...variant.values },
      removedFieldIds: [...variant.removedFieldIds],
      coreSuggestions: { ...variant.coreSuggestions },
      palette: variant.palette.map((entry) => ({ ...entry })),
      analysis: cloneDesignAnalysis(variant.analysis),
      promptPreview: variant.promptPreview,
      baseline: {
        label: variant.baseline.label,
        values: { ...variant.baseline.values },
        removedFieldIds: [...variant.baseline.removedFieldIds],
        coreSuggestions: { ...variant.baseline.coreSuggestions },
        palette: variant.baseline.palette.map((entry) => ({ ...entry })),
        analysis: cloneDesignAnalysis(variant.baseline.analysis),
        promptPreview: variant.baseline.promptPreview,
      },
      pendingInstruction: variant.pendingInstruction,
      pendingScope: variant.pendingScope,
      isModifying: variant.isModifying,
    })),
    lastRawResponse: session.lastRawResponse,
  };
}

export function buildKvVariantPromptPreview(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
  analysis: DesignStructuredAnalysis,
  palette: DesignStructuredPaletteEntry[],
) {
  return assembleDesignStructuredShortcutPrompt(shortcut, values, removedFieldIds, analysis, palette);
}

export function deriveVariantPalette(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
  analysis: DesignStructuredAnalysis,
  existingPalette: DesignStructuredPaletteEntry[],
  promptPreview?: string,
) {
  return derivePaletteFromVariantContent({
    analysis,
    promptPreview,
    basePrompt: buildShortcutPrompt(shortcut, values, {
      removedFieldIds,
      usePlaceholder: false,
    }),
    existingPalette,
  });
}

export function replaceColorInShortcutValues(
  values: ShortcutPromptValues,
  previousHex: string,
  nextHex: string,
) {
  return Object.fromEntries(
    Object.entries(values).map(([fieldId, value]) => [
      fieldId,
      replaceHexColorReferences(value, previousHex, nextHex),
    ]),
  );
}

export function replaceColorInAnalysis(
  analysis: DesignStructuredAnalysis,
  previousHex: string,
  nextHex: string,
) {
  return {
    canvas: {
      tokens: analysis.canvas.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.canvas.detailText, previousHex, nextHex),
    },
    subject: {
      tokens: analysis.subject.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.subject.detailText, previousHex, nextHex),
    },
    background: {
      tokens: analysis.background.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.background.detailText, previousHex, nextHex),
    },
    layout: {
      tokens: analysis.layout.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.layout.detailText, previousHex, nextHex),
    },
    typography: {
      tokens: analysis.typography.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.typography.detailText, previousHex, nextHex),
    },
  };
}

export function replacePaletteWeightsInAnalysis(
  analysis: DesignStructuredAnalysis,
  hex: string,
  previousWeight: string,
  nextWeight: string,
) {
  return {
    canvas: {
      tokens: analysis.canvas.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.canvas.detailText, hex, previousWeight, nextWeight),
    },
    subject: {
      tokens: analysis.subject.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.subject.detailText, hex, previousWeight, nextWeight),
    },
    background: {
      tokens: analysis.background.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.background.detailText, hex, previousWeight, nextWeight),
    },
    layout: {
      tokens: analysis.layout.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.layout.detailText, hex, previousWeight, nextWeight),
    },
    typography: {
      tokens: analysis.typography.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.typography.detailText, hex, previousWeight, nextWeight),
    },
  };
}

export function buildStructuredVariantPayload(variant: ShortcutOptimizationVariantDraft) {
  return {
    id: variant.id,
    label: variant.label,
    coreFields: {
      mainTitle: variant.values.mainTitle || "",
      subTitle: variant.values.subTitle || "",
      eventTime: variant.values.eventTime || "",
      style: variant.values.style || "",
      primaryColor: variant.values.primaryColor || "",
    },
    coreSuggestions: {
      mainTitle: variant.coreSuggestions.mainTitle || "",
      subTitle: variant.coreSuggestions.subTitle || "",
      eventTime: variant.coreSuggestions.eventTime || "",
      style: variant.coreSuggestions.style || "",
      primaryColor: variant.coreSuggestions.primaryColor || "",
    },
    analysis: cloneDesignAnalysis(variant.analysis),
    promptPreview: variant.promptPreview,
  };
}

export function createShortcutOptimizationVariants(
  shortcut: PlaygroundShortcut,
  baseValues: ShortcutPromptValues,
  removedFieldIds: string[],
  rawText: string,
): ShortcutOptimizationVariantDraft[] {
  const parsed = parseDesignStructuredOptimizationResponse(rawText);

  return KV_STRUCTURED_VARIANT_IDS.map((variantId, index) => {
    const variant = parsed.variants.find((item) => item.id === variantId);
    if (!variant) {
      throw new Error(`缺少优化版本 ${variantId}`);
    }

    const nextValues = mergeLockedKvValues(baseValues, variant.coreFields);
    const nextAnalysis = cloneDesignAnalysis(variant.analysis);
    const nextPalette = deriveVariantPalette(
      shortcut,
      nextValues,
      removedFieldIds,
      nextAnalysis,
      variant.palette,
      variant.promptPreview,
    );
    const promptPreview = buildKvVariantPromptPreview(shortcut, nextValues, removedFieldIds, nextAnalysis, nextPalette);

    return {
      id: variant.id,
      label: variant.label || `版本 ${index + 1}`,
      values: nextValues,
      removedFieldIds: [...removedFieldIds],
      coreSuggestions: {
        ...createEmptyCoreSuggestionValues(),
        ...variant.coreSuggestions,
      },
      palette: nextPalette,
      analysis: nextAnalysis,
      promptPreview,
      baseline: {
        label: variant.label || `版本 ${index + 1}`,
        values: cloneShortcutValues(nextValues),
        removedFieldIds: [...removedFieldIds],
        coreSuggestions: {
          ...createEmptyCoreSuggestionValues(),
          ...variant.coreSuggestions,
        },
        palette: cloneDesignPalette(nextPalette),
        analysis: cloneDesignAnalysis(nextAnalysis),
        promptPreview,
      },
      pendingInstruction: "",
      pendingScope: "variant",
      isModifying: false,
    };
  });
}
