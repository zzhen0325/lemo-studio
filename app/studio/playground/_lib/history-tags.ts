import type { GenerationConfig } from "@/types/database";

export type HistoryTagKind = "moodboard" | "preset" | "edit";

export interface HistoryTag {
  kind: HistoryTagKind;
  label: string;
}

export interface MoodboardTemplateMetadata {
  id?: string;
  name: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isBannerGeneration(config?: GenerationConfig | Record<string, unknown> | null): boolean {
  const record = asRecord(config);
  return record?.generationMode === "banner";
}

export function isHistoryEditGeneration(config?: GenerationConfig | Record<string, unknown> | null): boolean {
  const record = asRecord(config);
  if (!record || isBannerGeneration(record)) {
    return false;
  }

  if (record.isEdit === true || record.type === "edit") {
    return true;
  }

  // Backward compatibility for legacy edit records missing `isEdit`.
  const editConfig = asRecord(record.editConfig);
  const hasOriginalImage = Boolean(asTrimmedString(editConfig?.originalImageUrl));
  const hasParentId = Boolean(asTrimmedString(record.parentId));
  return hasOriginalImage && hasParentId;
}

export function getMoodboardTemplateMetadata(
  config?: GenerationConfig | Record<string, unknown> | null,
): MoodboardTemplateMetadata | null {
  const record = asRecord(config);
  const name = asTrimmedString(record?.moodboardTemplateName);
  if (!name) {
    return null;
  }

  const id = asTrimmedString(record?.moodboardTemplateId) || undefined;
  return { id, name };
}

export function withMoodboardTemplateMetadata(
  config: GenerationConfig,
  metadata?: MoodboardTemplateMetadata | null,
): GenerationConfig {
  const nextConfig = { ...config };
  const nextName = asTrimmedString(metadata?.name);

  if (!nextName) {
    delete nextConfig.moodboardTemplateId;
    delete nextConfig.moodboardTemplateName;
    return nextConfig;
  }

  nextConfig.moodboardTemplateName = nextName;
  const nextId = asTrimmedString(metadata?.id);
  if (nextId) {
    nextConfig.moodboardTemplateId = nextId;
  } else {
    delete nextConfig.moodboardTemplateId;
  }
  return nextConfig;
}

export function normalizeHistoryConfigForGeneration(config: GenerationConfig): GenerationConfig {
  const nextConfig = { ...config };

  if (isBannerGeneration(nextConfig)) {
    nextConfig.isEdit = false;
    delete nextConfig.editConfig;
    delete nextConfig.parentId;
    delete nextConfig.imageEditorSession;
    delete nextConfig.tldrawSnapshot;
    return nextConfig;
  }

  if (!isHistoryEditGeneration(nextConfig)) {
    nextConfig.isEdit = false;
    delete nextConfig.editConfig;
    delete nextConfig.parentId;
    delete nextConfig.imageEditorSession;
    delete nextConfig.tldrawSnapshot;
    return nextConfig;
  }

  nextConfig.isEdit = true;
  return nextConfig;
}

export function buildHistoryTags(config?: GenerationConfig | Record<string, unknown> | null): HistoryTag[] {
  const tags: HistoryTag[] = [];

  const moodboardTemplate = getMoodboardTemplateMetadata(config);
  if (moodboardTemplate) {
    tags.push({
      kind: "moodboard",
      label: `MOODBOARD: ${moodboardTemplate.name}`,
    });
  }

  const record = asRecord(config);
  const isPreset = record?.isPreset === true;
  const presetName = asTrimmedString(record?.presetName);
  if (isPreset && presetName) {
    tags.push({
      kind: "preset",
      label: `PRESET: ${presetName}`,
    });
  }

  if (isHistoryEditGeneration(record)) {
    tags.push({
      kind: "edit",
      label: "EDIT",
    });
  }

  return tags;
}
