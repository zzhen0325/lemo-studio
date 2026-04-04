import { describe, expect, it } from 'vitest';

import {
  normalizePromptTemplateDraftForSave,
  shouldShowMoodboardPromptSparkle,
  syncPromptFieldsWithTemplate,
} from '@/app/studio/playground/_lib/moodboard-prompt-template';

describe('moodboard prompt template helpers', () => {
  it('hides sparkle button for builtin shortcuts', () => {
    expect(shouldShowMoodboardPromptSparkle('lemo')).toBe(false);
    expect(shouldShowMoodboardPromptSparkle('USKV')).toBe(false);
    expect(shouldShowMoodboardPromptSparkle('us-kv')).toBe(false);
    expect(shouldShowMoodboardPromptSparkle('sea_kv')).toBe(false);
    expect(shouldShowMoodboardPromptSparkle('jp kv')).toBe(false);
  });

  it('shows sparkle button for custom shortcuts and moodboards', () => {
    expect(shouldShowMoodboardPromptSparkle()).toBe(true);
    expect(shouldShowMoodboardPromptSparkle('custom-kv')).toBe(true);
    expect(shouldShowMoodboardPromptSparkle('brand-new')).toBe(true);
  });

  it('syncs prompt fields with template tokens and removes unused fields', () => {
    const fields = syncPromptFieldsWithTemplate(
      'A poster with {{hero}} in {{scene}} and {{hero}} again',
      [
        {
          key: 'hero',
          label: '主角',
          placeholder: '输入主角',
          type: 'text',
          defaultValue: 'lemo',
          required: true,
          options: [],
          order: 3,
        },
        {
          key: 'legacy',
          label: '历史字段',
          placeholder: 'unused',
          type: 'text',
          defaultValue: 'old',
          required: false,
          options: [],
          order: 4,
        },
      ],
    );

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      key: 'hero',
      label: '主角',
      defaultValue: 'lemo',
      required: true,
      order: 0,
    });
    expect(fields[1]).toMatchObject({
      key: 'scene',
      label: 'scene',
      placeholder: 'scene',
      type: 'text',
      defaultValue: '',
      required: false,
      order: 1,
    });
  });

  it('clears fields when template has no tokens', () => {
    const fields = syncPromptFieldsWithTemplate('纯文本模板，无变量。', [
      {
        key: 'hero',
        label: '主角',
        placeholder: '输入主角',
        type: 'text',
        defaultValue: 'lemo',
        required: true,
        options: [],
        order: 0,
      },
    ]);

    expect(fields).toEqual([]);
  });

  it('clears prompt fields when saving an empty template', () => {
    const result = normalizePromptTemplateDraftForSave('   ', [
      {
        key: 'hero',
        label: '主角',
        placeholder: '输入主角',
        type: 'text',
        defaultValue: 'lemo',
        required: true,
        options: [],
        order: 0,
      },
    ]);

    expect(result).toEqual({
      promptTemplate: '',
      promptFields: [],
      missingDefinitions: [],
      unusedFields: [],
    });
  });

  it('preserves mismatch detection for non-empty templates during save normalization', () => {
    const result = normalizePromptTemplateDraftForSave(
      'A poster with {{hero}}',
      [
        {
          key: 'hero',
          label: '主角',
          placeholder: '输入主角',
          type: 'text',
          defaultValue: 'lemo',
          required: true,
          options: [],
          order: 3,
        },
        {
          key: 'scene',
          label: '场景',
          placeholder: '输入场景',
          type: 'text',
          defaultValue: 'studio',
          required: false,
          options: [],
          order: 4,
        },
      ],
    );

    expect(result.promptTemplate).toBe('A poster with {{hero}}');
    expect(result.promptFields.map((field) => field.key)).toEqual(['hero', 'scene']);
    expect(result.unusedFields).toEqual(['scene']);
    expect(result.missingDefinitions).toEqual([]);
  });
});
