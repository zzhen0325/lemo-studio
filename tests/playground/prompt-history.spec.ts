import { describe, expect, it } from 'vitest';

import {
  createPromptOptimizationHistoryItems,
  getGalleryPromptCategory,
  getPromptOptimizationSource,
  IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
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
      ],
      configBase: {
        model: 'coze_seedream4_5',
        width: 1024,
        height: 1024,
      },
    });

    expect(items).toHaveLength(2);
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
        version: 1,
        sourceKind: 'plain_text',
        taskId: 'opt-1',
        originalPrompt: 'orig',
        activeVariantId: 'v1',
        activeVariantLabel: '方案 A',
      },
    })).toBe('optimized_generation');
  });
});
