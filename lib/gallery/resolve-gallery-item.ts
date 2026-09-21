import {
  getGalleryPromptCategory,
  getGalleryPromptCategoryLabel,
  getPromptCardThumbnailSource,
  shouldShowInGalleryImageWall,
} from '@/app/studio/playground/_lib/prompt-history';
import { resolveGalleryImageUrl, resolveGalleryPreviewUrl } from '@/lib/gallery-asset';
import type { Generation } from '@/types/database';
import { getModelDisplayName, MODEL_DISPLAY_NAME_MAP } from './model-display';
import type {
  GalleryCustomDateRange,
  GalleryFilterState,
  GalleryItemViewModel,
  GalleryModelFilterOption,
  GalleryTimeFilter,
  GalleryTimePreset,
} from './types';

function getGalleryItemId(item: Generation, index: number) {
  const normalizedId = item.id?.trim();
  if (normalizedId) {
    return normalizedId;
  }

  return `gallery-item-${item.createdAt || 'unknown'}-${index}`;
}

function isItemWithinTimeWindow(item: GalleryItemViewModel, timeFilter: GalleryTimeFilter): boolean {
  if (timeFilter.kind === 'preset') {
    if (timeFilter.value === 'all') {
      return true;
    }
    return isItemWithinDayWindow(item, timeFilter.value);
  }
  return isItemWithinCustomRange(item, timeFilter.range);
}

function isItemWithinDayWindow(item: GalleryItemViewModel, days: GalleryTimePreset): boolean {
  const numericDays = Number(days);
  if (!Number.isFinite(numericDays) || numericDays <= 0) {
    return true;
  }

  const createdAtMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
  if (Number.isNaN(createdAtMs)) {
    return true;
  }

  const cutoffMs = Date.now() - numericDays * 24 * 60 * 60 * 1000;
  return createdAtMs >= cutoffMs;
}

function parseLocalDateBoundary(value: string | undefined, endOfDay: boolean): number | null {
  if (!value) return null;
  // 解析为本地时区的 YYYY-MM-DD，避免 UTC 跨天导致 off-by-one
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const fallback = Date.parse(value);
    return Number.isNaN(fallback) ? null : fallback;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (endOfDay) {
    return new Date(year, monthIndex, day, 23, 59, 59, 999).getTime();
  }
  return new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
}

function isItemWithinCustomRange(item: GalleryItemViewModel, range: GalleryCustomDateRange): boolean {
  const from = parseLocalDateBoundary(range.from, false);
  const to = parseLocalDateBoundary(range.to, true);
  if (from === null && to === null) {
    return true;
  }
  const createdAtMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
  if (Number.isNaN(createdAtMs)) {
    // 没有有效 createdAt 时按保留策略放行，不误伤历史回填数据
    return true;
  }
  if (from !== null && createdAtMs < from) {
    return false;
  }
  if (to !== null && createdAtMs > to) {
    return false;
  }
  return true;
}

export function resolveGalleryItem(item: Generation, index: number): GalleryItemViewModel {
  const id = getGalleryItemId(item, index);
  const prompt = item.config?.prompt?.trim() || '';
  const promptCategory = getGalleryPromptCategory(item.config);
  const outputUrl = item.outputUrl || '';
  const previewUrl = resolveGalleryPreviewUrl(outputUrl);
  const displayUrl = resolveGalleryImageUrl(outputUrl);
  const sourceImage = item.config?.sourceImageUrls?.[0];
  const sourceImageUrl = sourceImage ? resolveGalleryImageUrl(sourceImage) : undefined;
  const thumbnailSource = getPromptCardThumbnailSource(item);
  const thumbnailUrl = thumbnailSource ? resolveGalleryImageUrl(thumbnailSource) : undefined;

  return {
    id,
    raw: item,
    previewUrl,
    displayUrl,
    downloadUrl: displayUrl,
    moodboardImagePath: outputUrl,
    prompt,
    promptCategory,
    promptCategoryLabel: getGalleryPromptCategoryLabel(promptCategory),
    model: item.config?.model || 'Unknown Model',
    presetName: item.config?.presetName || '',
    createdAt: item.createdAt,
    width: Number(item.config?.width) || 1024,
    height: Number(item.config?.height) || 1024,
    sourceImageUrl,
    thumbnailUrl,
    imageLoadKey: `${id}:${outputUrl}`,
    searchText: prompt.toLowerCase(),
    isPromptVisible: Boolean(prompt),
    isImageVisible: shouldShowInGalleryImageWall(item),
  };
}

export function resolveGalleryItems(items: Generation[]) {
  return items.map(resolveGalleryItem);
}

export function isGalleryItemFeatured(item: Generation): boolean {
  const stats = item.interactionStats;
  if (!stats) return false;
  // 精选：任一交互指标 > 0 即视为精选
  return (
    stats.likeCount > 0
    || stats.moodboardAddCount > 0
    || stats.downloadCount > 0
    || stats.editCount > 0
    || Boolean(stats.lastLikedAt)
    || Boolean(stats.lastMoodboardAddedAt)
    || Boolean(stats.lastDownloadedAt)
    || Boolean(stats.lastEditedAt)
  );
}

export function filterGalleryItems(
  items: GalleryItemViewModel[],
  filters: GalleryFilterState,
  options: { currentUserId?: string | null } = {},
) {
  const normalizedQuery = filters.searchQuery.trim().toLowerCase();
  const normalizedOwnerId = options.currentUserId?.trim() || '';
  const selectedModelRawIds = new Set(
    filters.selectedModels
      .map((displayName) => resolveSelectedModelRawIds(displayName))
      .flat(),
  );

  return items.filter((item) => {
    if (normalizedQuery && !item.searchText.includes(normalizedQuery)) {
      return false;
    }

    if (selectedModelRawIds.size > 0 && !selectedModelRawIds.has(item.model)) {
      return false;
    }

    if (filters.selectedPresets.length > 0 && !filters.selectedPresets.includes(item.presetName)) {
      return false;
    }

    if (
      filters.selectedPromptCategories.length > 0
      && !filters.selectedPromptCategories.includes(item.promptCategory)
    ) {
      return false;
    }

    if (filters.byMeOnly && normalizedOwnerId) {
      if ((item.raw.userId || '').trim() !== normalizedOwnerId) {
        return false;
      }
    }

    if (!isItemWithinTimeWindow(item, filters.timeFilter)) {
      return false;
    }

    return true;
  });
}

export function buildGalleryFilterOptions(items: GalleryItemViewModel[]) {
  const rawIdToDisplay = new Map<string, string>();
  const presets = new Set<string>();

  for (const item of items) {
    const rawId = item.model;
    if (rawId && !rawIdToDisplay.has(rawId)) {
      rawIdToDisplay.set(rawId, getModelDisplayName(rawId));
    }
    if (item.presetName) {
      presets.add(item.presetName);
    }
  }

  const groupedByDisplay = new Map<string, string[]>();
  for (const [rawId, displayName] of rawIdToDisplay) {
    const bucket = groupedByDisplay.get(displayName) ?? [];
    bucket.push(rawId);
    groupedByDisplay.set(displayName, bucket);
  }

  const models: GalleryModelFilterOption[] = Array.from(groupedByDisplay.entries())
    .map(([label, rawIds]) => ({
      value: label,
      label,
      rawIds: rawIds.slice().sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    models,
    presets: Array.from(presets).sort(),
  };
}

const MODEL_DISPLAY_TO_RAW_IDS: Map<string, string[]> = (() => {
  const temp = new Map<string, string[]>();
  for (const [rawId, displayName] of Object.entries(MODEL_DISPLAY_NAME_MAP)) {
    const bucket = temp.get(displayName) ?? [];
    bucket.push(rawId);
    temp.set(displayName, bucket);
  }
  return temp;
})();

/**
 * Resolves a user-facing display name (the value stored in `selectedModels`)
 * back to the underlying raw model ids. If the input is itself a known raw
 * id, it is normalised to its display name first so callers that pass either
 * form keep working.
 */
function resolveSelectedModelRawIds(displayName: string): string[] {
  if (!displayName) {
    return [];
  }
  const displayFromMap = MODEL_DISPLAY_NAME_MAP[displayName];
  const canonical = displayFromMap ?? displayName;
  const bucket = MODEL_DISPLAY_TO_RAW_IDS.get(canonical);
  if (bucket && bucket.length > 0) {
    return bucket;
  }
  return [displayName];
}
