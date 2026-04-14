import { describe, expect, it } from 'vitest';

import { IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE } from '@/app/studio/playground/_lib/prompt-history';
import {
  buildGalleryFilterOptions,
  filterGalleryItems,
  isGalleryItemDownloaded,
  resolveGalleryItem,
} from '@/lib/gallery/resolve-gallery-item';
import type { Generation } from '@/types/database';

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

    expect(options.models).toEqual(['coze_seedream4_5', 'flux-dev']);
    expect(options.presets).toEqual(['Portrait', 'Product']);
  });
});

describe('isGalleryItemDownloaded', () => {
  it('returns true if downloadCount > 0', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 0, moodboardAddCount: 0, downloadCount: 1, editCount: 0 },
    });
    expect(isGalleryItemDownloaded(item)).toBe(true);
  });

  it('returns true if lastDownloadedAt is present', () => {
    const item = createGeneration({
      interactionStats: { likeCount: 0, moodboardAddCount: 0, downloadCount: 0, editCount: 0, lastDownloadedAt: '2026-04-14T10:00:00Z' },
    });
    expect(isGalleryItemDownloaded(item)).toBe(true);
  });

  it('returns false if no interactionStats or counts are zero', () => {
    const item1 = createGeneration();
    const item2 = createGeneration({
      interactionStats: { likeCount: 10, moodboardAddCount: 0, downloadCount: 0, editCount: 0 },
    });
    expect(isGalleryItemDownloaded(item1)).toBe(false);
    expect(isGalleryItemDownloaded(item2)).toBe(false);
  });
});

describe('filterGalleryItems', () => {
  const items = [
    resolveGalleryItem(createGeneration({ config: { prompt: 'cat', width: 1024, height: 1024, model: 'm1', presetName: 'p1' } }), 0),
    resolveGalleryItem(createGeneration({ config: { prompt: 'dog', width: 1024, height: 1024, model: 'm2', presetName: 'p2' } }), 1),
    resolveGalleryItem(createGeneration({ config: { prompt: 'bird', width: 1024, height: 1024, model: 'm1', presetName: 'p2' } }), 2),
  ];

  it('filters by search query', () => {
    const result = filterGalleryItems(items, { searchQuery: 'cat', selectedModels: [], selectedPresets: [], selectedPromptCategories: [] });
    expect(result).toHaveLength(1);
    expect(result[0].searchText).toContain('cat');
  });

  it('filters by model', () => {
    const result = filterGalleryItems(items, { searchQuery: '', selectedModels: ['m1'], selectedPresets: [], selectedPromptCategories: [] });
    expect(result).toHaveLength(2);
  });

  it('filters by preset', () => {
    const result = filterGalleryItems(items, { searchQuery: '', selectedModels: [], selectedPresets: ['p2'], selectedPromptCategories: [] });
    expect(result).toHaveLength(2);
  });

  it('combines multiple filters', () => {
    const result = filterGalleryItems(items, { searchQuery: 'bird', selectedModels: ['m1'], selectedPresets: ['p2'], selectedPromptCategories: [] });
    expect(result).toHaveLength(1);
    expect(result[0].searchText).toContain('bird');
  });
});
