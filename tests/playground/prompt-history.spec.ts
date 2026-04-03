import { describe, expect, it } from 'vitest';

import {
  createPromptOptimizationHistoryItems,
  getGalleryPromptCategory,
  getPromptCardThumbnailSource,
  getPromptOptimizationSource,
  IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
  shouldShowInGalleryImageWall,
  withPromptOptimizationSource,
  withoutPromptOptimizationSource,
} from '@/app/studio/playground/_lib/prompt-history';

describe('prompt history helpers', () => {
  it('creates optimization history items with shared source metadata', () => {
    const createdAt = '2026-03-27T10:00:00.000Z';
    const items = createPromptOptimizationHistoryItems({
      taskId: 'opt-123',
      createdAt,
      userId: 'user-1',
      originalPrompt: '原始提示词',
      sourceKind: 'plain_text',
      variants: [
        { id: 'v1', label: '方案 A', prompt: '优化方案 A' },
        { id: 'v2', label: '方案 B', prompt: '优化方案 B' },
        { id: 'v3', label: '方案 C', prompt: '优化方案 C' },
        { id: 'v4', label: '方案 D', prompt: '优化方案 D' },
      ],
      configBase: {
        model: 'coze_seedream4_5',
        width: 1024,
        height: 1024,
      },
    });

    expect(items).toHaveLength(4);
    expect(items[0].config.historyRecordType).toBe('prompt_optimization');
    expect(items[0].config.promptCategory).toBe('prompt_optimization');

    const source = getPromptOptimizationSource(items[0].config);
    expect(source).toMatchObject({
      sourceKind: 'plain_text',
      taskId: 'opt-123',
      originalPrompt: '原始提示词',
      activeVariantId: 'v1',
      activeVariantLabel: '方案 A',
    });
  });

  it('supports limiting history backfill items', () => {
    const items = createPromptOptimizationHistoryItems({
      taskId: 'opt-limit-1',
      createdAt: '2026-03-27T11:00:00.000Z',
      userId: 'user-1',
      originalPrompt: '原始提示词',
      sourceKind: 'kv_structured',
      variants: [
        { id: 'v1', label: '方案 A', prompt: '优化方案 A' },
        { id: 'v2', label: '方案 B', prompt: '优化方案 B' },
      ],
      configBase: {
        model: 'coze_seedream4_5',
        width: 1024,
        height: 1024,
      },
      maxItems: 1,
    });

    expect(items).toHaveLength(1);
    expect(getPromptOptimizationSource(items[0].config)?.activeVariantId).toBe('v1');
  });

  it('detects prompt categories from config metadata', () => {
    expect(getGalleryPromptCategory({
      prompt: 'desc',
      width: 1024,
      height: 1024,
      model: 'gemini',
      historyRecordType: IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
    })).toBe('image_description');

    expect(getGalleryPromptCategory({
      prompt: 'edit prompt',
      width: 1024,
      height: 1024,
      model: 'gemini',
      isEdit: true,
    })).toBe('edit_generation');

    expect(getGalleryPromptCategory({
      prompt: 'optimized',
      width: 1024,
      height: 1024,
      model: 'gemini',
      optimizationSource: {
        version: 2,
        sourceKind: 'plain_text',
        taskId: 'opt-1',
        originalPrompt: 'orig',
        activeVariantId: 'v1',
        activeVariantLabel: '方案 A',
      },
    })).toBe('optimized_generation');
  });

  it('filters visibility for gallery image wall', () => {
    const baseConfig = {
      prompt: 'desc',
      width: 1024,
      height: 1024,
      model: 'gemini',
    };

    expect(shouldShowInGalleryImageWall({
      outputUrl: 'https://example.com/image.png',
      config: baseConfig,
    })).toBe(true);

    expect(shouldShowInGalleryImageWall({
      outputUrl: 'https://example.com/describe.png',
      config: {
        ...baseConfig,
        historyRecordType: IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
      },
    })).toBe(false);

    expect(shouldShowInGalleryImageWall({
      outputUrl: 'https://example.com/prompt-opt.png',
      config: {
        ...baseConfig,
        historyRecordType: 'prompt_optimization',
      },
    })).toBe(false);

    expect(shouldShowInGalleryImageWall({
      outputUrl: '',
      config: baseConfig,
    })).toBe(false);
  });

  it('returns the first source image as prompt card thumbnail source', () => {
    const baseConfig = {
      prompt: 'desc',
      width: 1024,
      height: 1024,
      model: 'gemini',
    };

    expect(getPromptCardThumbnailSource({
      config: {
        ...baseConfig,
        sourceImageUrls: ['https://example.com/source-1.png', 'https://example.com/source-2.png'],
      },
    })).toBe('https://example.com/source-1.png');

    expect(getPromptCardThumbnailSource({
      config: {
        ...baseConfig,
        sourceImageUrls: [],
      },
    })).toBeNull();

    expect(getPromptCardThumbnailSource({
      config: {
        ...baseConfig,
      },
    })).toBeNull();
  });

  it('parses inline shortcut optimization metadata', () => {
    const source = getPromptOptimizationSource({
      prompt: 'optimized shortcut prompt',
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
      optimizationSource: {
        version: 2,
        sourceKind: 'shortcut_inline',
        taskId: 'opt-inline-1',
        originalPrompt: 'original shortcut prompt',
        activeVariantId: 'v1',
        activeVariantLabel: '方案 A',
        shortcutId: 'lemo',
      },
    });

    expect(source).toMatchObject({
      sourceKind: 'shortcut_inline',
      taskId: 'opt-inline-1',
      shortcutId: 'lemo',
    });
  });

  it('removes optimization-only history type markers when reusing prompt config', () => {
    const sourcePayload = {
      version: 2 as const,
      sourceKind: 'plain_text' as const,
      taskId: 'opt-keep-1',
      originalPrompt: 'orig prompt',
      activeVariantId: 'v1',
      activeVariantLabel: '方案 A',
    };
    const optimized = withPromptOptimizationSource({
      prompt: 'optimized prompt',
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
      historyRecordType: 'prompt_optimization',
      promptCategory: 'prompt_optimization',
    }, sourcePayload);

    expect(optimized.historyRecordType).toBeUndefined();
    expect(optimized.promptCategory).toBe('optimized_generation');

    const reverted = withoutPromptOptimizationSource({
      ...optimized,
      historyRecordType: 'image_description',
      promptCategory: 'image_description',
    });

    expect(reverted.historyRecordType).toBeUndefined();
    expect(reverted.promptCategory).toBeUndefined();
    expect(reverted.optimizationSource).toBeUndefined();
  });
});
