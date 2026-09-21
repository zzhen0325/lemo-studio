import { describe, expect, it } from 'vitest';

import { IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE } from '@/app/studio/playground/_lib/prompt-history';
import {
  buildGalleryFilterOptions,
  filterGalleryItems,
  isGalleryItemFeatured,
  resolveGalleryItem,
} from '@/lib/gallery/resolve-gallery-item';
import type { GalleryFilterState } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

function makeFilters(overrides: Partial<GalleryFilterState> = {}): GalleryFilterState {
  return {
    searchQuery: '',
    selectedModels: [],
    selectedPresets: [],
    selectedPromptCategories: [],
    byMeOnly: false,
    timeFilter: { kind: 'preset', value: 'all' },
    ...overrides,
  };
}

function createGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: 'gen-1',
    userId: 'user-1',
    projectId: 'default',
    outputUrl: 'ljhwZthlaukjlkulzlp/gallery/output.png',
    status: 'completed',
    createdAt: '2026-04-07T12:00:00.000Z',
    config: {
      prompt: 'A sharp editorial portrait',
      width: 1024,
      height: 1536,
      model: 'coze_seedream4_5',
      presetName: 'Portrait',
      sourceImageUrls: [
        'https://coze-coding-project.tos.coze.site/coze_storage_xxx/ljhwZthlaukjlkulzlp/gallery/reference.png?sign=demo',
      ],
      ...(overrides.config || {}),
    },
    ...overrides,
  };
}

describe('resolveGalleryItem', () => {
  it('normalizes display and download urls, thumbnail, and prompt metadata', () => {
    const item = resolveGalleryItem(createGeneration(), 0);

    expect(item.previewUrl).toBe('/api/storage/image?key=ljhwZthlaukjlkulzlp%2Fgallery%2Foutput.png&w=384&q=72&format=webp');
    expect(item.displayUrl).toBe('/api/storage/image?key=ljhwZthlaukjlkulzlp%2Fgallery%2Foutput.png');
    expect(item.downloadUrl).toBe(item.displayUrl);
    expect(item.thumbnailUrl).toBe('/api/storage/image?key=ljhwZthlaukjlkulzlp%2Fgallery%2Freference.png');
    expect(item.sourceImageUrl).toBe(item.thumbnailUrl);
    expect(item.promptCategory).toBe('standard_generation');
    expect(item.promptCategoryLabel).toBe('普通生成');
    expect(item.isImageVisible).toBe(true);
    expect(item.isPromptVisible).toBe(true);
  });

  it('keeps image-description records out of the masonry wall', () => {
    const item = resolveGalleryItem(
      createGeneration({
        id: 'desc-1',
        config: {
          prompt: 'Describe this image',
          width: 1024,
          height: 1024,
          model: 'gemini-2.5-flash-image-preview',
          historyRecordType: IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
        },
      }),
      0,
    );

    expect(item.promptCategory).toBe('image_description');
    expect(item.promptCategoryLabel).toBe('图像描述');
    expect(item.isImageVisible).toBe(false);
    expect(item.isPromptVisible).toBe(true);
  });

  it('classifies edit generations as edit gallery items even for legacy edit records', () => {
    const item = resolveGalleryItem(
      createGeneration({
        id: 'edit-1',
        config: {
          prompt: 'Retouch the lighting',
          width: 1024,
          height: 1024,
          model: 'gemini-3-pro-image-preview',
          isEdit: false,
          parentId: 'gen-parent',
          editConfig: {
            canvasJson: {},
            referenceImages: [],
            originalImageUrl: 'https://example.com/original.png',
            annotations: [],
            backgroundColor: 'transparent',
            canvasSize: { width: 1024, height: 1024 },
          },
        },
      }),
      0,
    );

    expect(item.promptCategory).toBe('edit_generation');
    expect(item.promptCategoryLabel).toBe('编辑生成');
    expect(item.isImageVisible).toBe(true);
  });

  it('builds sorted filter options from resolved items', () => {
    const options = buildGalleryFilterOptions([
      resolveGalleryItem(createGeneration(), 0),
      resolveGalleryItem(createGeneration({
        id: 'gen-2',
        config: {
          prompt: 'A product macro shot',
          width: 1024,
          height: 1024,
          model: 'flux-dev',
          presetName: 'Product',
        },
      }), 1),
    ]);

    expect(options.models).toEqual([
      { value: 'flux-dev', label: 'flux-dev', rawIds: ['flux-dev'] },
      { value: 'Seedream 4.5', label: 'Seedream 4.5', rawIds: ['coze_seedream4_5'] },
    ]);
    expect(options.presets).toEqual(['Portrait', 'Product']);
  });

  it('groups multiple raw ids that share a display name into a single option', () => {
    const options = buildGalleryFilterOptions([
      resolveGalleryItem(createGeneration({ id: 'gen-1' }), 0),
      resolveGalleryItem(createGeneration({
        id: 'gen-2',
        config: {
          prompt: 'A product macro shot',
          width: 1024,
          height: 1024,
          model: 'seed4_0916_lemo',
          presetName: 'Product',
        },
      }), 1),
      resolveGalleryItem(createGeneration({
        id: 'gen-3',
        config: {
          prompt: 'A vintage scene',
          width: 1024,
          height: 1024,
          model: 'seed4_v2_0226lemo',
          presetName: 'Cinematic',
        },
      }), 2),
    ]);

    const lemoSeed = options.models.find((option) => option.value === 'Lemo Seed');
    expect(lemoSeed).toBeDefined();
    expect(lemoSeed?.rawIds).toEqual(['seed4_0916_lemo', 'seed4_v2_0226lemo']);
    expect(options.models.find((option) => option.value === 'Seedream 4.5')?.rawIds).toEqual(['coze_seedream4_5']);
  });
});

describe('isGalleryItemFeatured', () => {
  it('returns true if downloadCount > 0', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 0, moodboardAddCount: 0, downloadCount: 1, editCount: 0 },
    });
    expect(isGalleryItemFeatured(item)).toBe(true);
  });

  it('returns true if likeCount > 0', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 1, moodboardAddCount: 0, downloadCount: 0, editCount: 0 },
    });
    expect(isGalleryItemFeatured(item)).toBe(true);
  });

  it('returns true if moodboardAddCount > 0', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 0, moodboardAddCount: 1, downloadCount: 0, editCount: 0 },
    });
    expect(isGalleryItemFeatured(item)).toBe(true);
  });

  it('returns true if lastDownloadedAt is present', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 0, moodboardAddCount: 0, downloadCount: 0, editCount: 0, lastDownloadedAt: '2026-04-14T10:00:00Z' },
    });
    expect(isGalleryItemFeatured(item)).toBe(true);
  });

  it('returns false if no interactionStats or all counts are zero', () => {
    const item1 = createGeneration();
    expect(isGalleryItemFeatured(item1)).toBe(false);
  });
});

describe('filterGalleryItems', () => {
  const items = [
    resolveGalleryItem(createGeneration({ config: { prompt: 'cat', width: 1024, height: 1024, model: 'm1', presetName: 'p1' } }), 0),
    resolveGalleryItem(createGeneration({ config: { prompt: 'dog', width: 1024, height: 1024, model: 'm2', presetName: 'p2' } }), 1),
    resolveGalleryItem(createGeneration({ config: { prompt: 'bird', width: 1024, height: 1024, model: 'm1', presetName: 'p2' } }), 2),
  ];

  it('filters by search query', () => {
    const result = filterGalleryItems(items, makeFilters({ searchQuery: 'cat' }));
    expect(result).toHaveLength(1);
    expect(result[0].searchText).toContain('cat');
  });

  it('filters by model', () => {
    const result = filterGalleryItems(items, makeFilters({ selectedModels: ['m1'] }));
    expect(result).toHaveLength(2);
  });

  it('filters by display name across all underlying raw ids', () => {
    const lemoItems = [
      resolveGalleryItem(createGeneration({ id: 'l1', config: { prompt: 'lemo a', width: 1024, height: 1024, model: 'seed4_0916_lemo', presetName: 'p1' } }), 0),
      resolveGalleryItem(createGeneration({ id: 'l2', config: { prompt: 'lemo b', width: 1024, height: 1024, model: 'seed4_v2_0226lemo', presetName: 'p1' } }), 1),
      resolveGalleryItem(createGeneration({ id: 's1', config: { prompt: 'sd', width: 1024, height: 1024, model: 'coze_seedream4_5', presetName: 'p1' } }), 2),
    ];

    const result = filterGalleryItems(lemoItems, makeFilters({ selectedModels: ['Lemo Seed'] }));
    expect(result.map((item) => item.id)).toEqual(['l1', 'l2']);
  });

  it('filters by preset', () => {
    const result = filterGalleryItems(items, makeFilters({ selectedPresets: ['p2'] }));
    expect(result).toHaveLength(2);
  });

  it('combines multiple filters', () => {
    const result = filterGalleryItems(items, makeFilters({ searchQuery: 'bird', selectedModels: ['m1'], selectedPresets: ['p2'] }));
    expect(result).toHaveLength(1);
    expect(result[0].searchText).toContain('bird');
  });

  it('filters by me when byMeOnly is true and currentUserId matches', () => {
    const result = filterGalleryItems(items, makeFilters({ byMeOnly: true }), { currentUserId: 'user-1' });
    expect(result).toHaveLength(items.length);
  });

  it('filters by me to zero when currentUserId differs', () => {
    const result = filterGalleryItems(items, makeFilters({ byMeOnly: true }), { currentUserId: 'someone-else' });
    expect(result).toHaveLength(0);
  });

  it('filters by time window using createdAt', () => {
    const recentItem = resolveGalleryItem(
      createGeneration({ id: 'recent', createdAt: new Date().toISOString() }),
      0,
    );
    const oldItem = resolveGalleryItem(
      createGeneration({ id: 'old', createdAt: '2020-01-01T00:00:00.000Z' }),
      1,
    );

    const result = filterGalleryItems(
      [recentItem, oldItem],
      makeFilters({ timeFilter: { kind: 'preset', value: '7' } }),
    );
    expect(result.map((item) => item.id)).toEqual(['recent']);
  });

  it('filters by custom date range with from/to inclusive', () => {
    const inRangeItem = resolveGalleryItem(
      createGeneration({ id: 'in', createdAt: '2025-03-10T08:00:00.000Z' }),
      0,
    );
    const beforeItem = resolveGalleryItem(
      createGeneration({ id: 'before', createdAt: '2025-03-01T00:00:00.000Z' }),
      1,
    );
    const afterItem = resolveGalleryItem(
      createGeneration({ id: 'after', createdAt: '2025-03-25T00:00:00.000Z' }),
      2,
    );

    const result = filterGalleryItems(
      [inRangeItem, beforeItem, afterItem],
      makeFilters({
        timeFilter: { kind: 'custom', range: { from: '2025-03-05', to: '2025-03-15' } },
      }),
    );
    expect(result.map((item) => item.id)).toEqual(['in']);
  });

  it('treats empty custom range as no filter', () => {
    const recentItem = resolveGalleryItem(
      createGeneration({ id: 'recent', createdAt: new Date().toISOString() }),
      0,
    );
    const oldItem = resolveGalleryItem(
      createGeneration({ id: 'old', createdAt: '2020-01-01T00:00:00.000Z' }),
      1,
    );

    const result = filterGalleryItems(
      [recentItem, oldItem],
      makeFilters({ timeFilter: { kind: 'custom', range: {} } }),
    );
    expect(result.map((item) => item.id)).toEqual(['recent', 'old']);
  });
});
