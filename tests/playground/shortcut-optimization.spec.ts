import { describe, expect, it } from 'vitest';

import {
  getShortcutTemplateGenerationReadiness,
  type ActiveShortcutTemplate,
  type ShortcutOptimizationVariantDraft,
} from '@/app/studio/playground/_components/containers/shortcut-optimization';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';

function getRequiredShortcut(id: string) {
  const shortcut = getShortcutById(id);
  if (!shortcut) {
    throw new Error(`Missing shortcut: ${id}`);
  }
  return shortcut;
}

function createKvVariant(promptPreview: string): ShortcutOptimizationVariantDraft {
  const values = createShortcutPromptValues(getRequiredShortcut('us-kv'));
  const analysis = {
    canvas: { detailText: promptPreview },
    subject: { detailText: '' },
    background: { detailText: '' },
    layout: { detailText: '' },
    typography: { detailText: '' },
  };

  return {
    id: 'v1',
    label: '测试版本',
    values,
    removedFieldIds: [],
    coreSuggestions: values,
    palette: [],
    analysis,
    promptPreview,
    baseline: {
      label: '测试版本',
      values,
      removedFieldIds: [],
      coreSuggestions: values,
      palette: [],
      analysis,
      promptPreview,
    },
    pendingInstruction: '',
    pendingScope: 'variant',
    isModifying: false,
  };
}

describe('shortcut generation readiness', () => {
  it('allows optimized KV variants to generate when required token values are empty', () => {
    const shortcut = getRequiredShortcut('us-kv');
    const values = createShortcutPromptValues(shortcut);
    const variant = createKvVariant('A bold commercial KV poster with layered typography and clean retail lighting.');
    const template: ActiveShortcutTemplate = {
      shortcut,
      values,
      removedFieldIds: [],
      appliedPrompt: variant.promptPreview,
      optimizationSession: {
        sourceType: 'kv_shortcut',
        originValues: values,
        originRemovedFieldIds: [],
        activeVariantId: 'v1',
        variants: [variant],
        lastRawResponse: '{}',
      },
    };

    const readiness = getShortcutTemplateGenerationReadiness(template, variant);

    expect(readiness.canGenerate).toBe(true);
    expect(readiness.reason).toBeNull();
    expect(readiness.missingFields).toEqual([]);
  });

  it('keeps the required-token guard before KV structured optimization exists', () => {
    const shortcut = getRequiredShortcut('us-kv');
    const values = createShortcutPromptValues(shortcut);
    const template: ActiveShortcutTemplate = {
      shortcut,
      values,
      removedFieldIds: [],
      appliedPrompt: '',
    };

    const readiness = getShortcutTemplateGenerationReadiness(template);

    expect(readiness.canGenerate).toBe(false);
    expect(readiness.reason).toBe('missing_fields');
    expect(readiness.missingFields.map((field) => field.id)).toContain('mainTitle');
  });
});
