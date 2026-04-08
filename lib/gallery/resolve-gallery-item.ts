import {
  getGalleryPromptCategory,
  getGalleryPromptCategoryLabel,
  getPromptCardThumbnailSource,
  shouldShowInGalleryImageWall,
} from '@/app/studio/playground/_lib/prompt-history';
import { resolveGalleryImageUrl } from '@/lib/gallery-asset';
import type { Generation } from '@/types/database';
import type { GalleryFilterState, GalleryItemViewModel } from './types';

function getGalleryItemId(item: Generation, index: number) {
  const normalizedId = item.id?.trim();
  if (normalizedId) {
    return normalizedId;
  }

  return `gallery-item-${item.createdAt || 'unknown'}-${index}`;
}

export function resolveGalleryItem(item: Generation, index: number): GalleryItemViewModel {
  const id = getGalleryItemId(item, index);
  const prompt = item.config?.prompt?.trim() || '';
  const promptCategory = getGalleryPromptCategory(item.config);
  const outputUrl = item.outputUrl || '';
  const displayUrl = resolveGalleryImageUrl(outputUrl);
  const sourceImage = item.config?.sourceImageUrls?.[0];
  const sourceImageUrl = sourceImage ? resolveGalleryImageUrl(sourceImage) : undefined;
  const thumbnailSource = getPromptCardThumbnailSource(item);
  const thumbnailUrl = thumbnailSource ? resolveGalleryImageUrl(thumbnailSource) : undefined;

  return {
    id,
    raw: item,
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

export function filterGalleryItems(
  items: GalleryItemViewModel[],
  filters: GalleryFilterState,
) {
  const normalizedQuery = filters.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (normalizedQuery && !item.searchText.includes(normalizedQuery)) {
      return false;
    }

    if (filters.selectedModels.length > 0 && !filters.selectedModels.includes(item.model)) {
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

    return true;
  });
}

export function buildGalleryFilterOptions(items: GalleryItemViewModel[]) {
  const models = new Set<string>();
  const presets = new Set<string>();

  for (const item of items) {
    if (item.model) {
      models.add(item.model);
    }
    if (item.presetName) {
      presets.add(item.presetName);
    }
  }

  return {
    models: Array.from(models).sort(),
    presets: Array.from(presets).sort(),
  };
}
