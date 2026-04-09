import { describe, expect, it } from 'vitest';

import { IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE } from '@/app/studio/playground/_lib/prompt-history';
import {
  buildGalleryFilterOptions,
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
