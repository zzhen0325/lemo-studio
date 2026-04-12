import { describe, expect, it, vi } from 'vitest';

import {
  dispatchPlaygroundPromptOptimization,
  resolvePlaygroundPromptOptimizationFlow,
} from '@/app/studio/playground/_components/containers/prompt-optimization-dispatcher';
import type { ActiveShortcutTemplate } from '@/app/studio/playground/_components/containers/shortcut-optimization';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';

function createShortcutTemplate(shortcutId: string): ActiveShortcutTemplate {
  const shortcut = getShortcutById(shortcutId);
  if (!shortcut) {
    throw new Error(`Missing shortcut: ${shortcutId}`);
  }

  return {
    shortcut,
    values: createShortcutPromptValues(shortcut),
    removedFieldIds: [],
    appliedPrompt: '',
  };
}

describe('playground prompt optimization dispatcher', () => {
  it('routes KV shortcuts to the structured flow only', async () => {
    const kvTemplate = createShortcutTemplate('us-kv');
    const runKvStructuredPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runPlainTextPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runShortcutInlinePromptOptimization = vi.fn().mockResolvedValue(undefined);

    expect(resolvePlaygroundPromptOptimizationFlow(kvTemplate)).toBe('playground_kv_structured');

    await dispatchPlaygroundPromptOptimization({
      activeShortcutTemplate: kvTemplate,
      runKvStructuredPromptOptimization,
      runPlainTextPromptOptimization,
      runShortcutInlinePromptOptimization,
    });

    expect(runKvStructuredPromptOptimization).toHaveBeenCalledWith(kvTemplate);
    expect(runPlainTextPromptOptimization).not.toHaveBeenCalled();
    expect(runShortcutInlinePromptOptimization).not.toHaveBeenCalled();
  });

  it('routes plain prompt optimization when no shortcut template is active', async () => {
    const runKvStructuredPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runPlainTextPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runShortcutInlinePromptOptimization = vi.fn().mockResolvedValue(undefined);

    expect(resolvePlaygroundPromptOptimizationFlow(null)).toBe('playground_plain_text');

    await dispatchPlaygroundPromptOptimization({
      activeShortcutTemplate: null,
      runKvStructuredPromptOptimization,
      runPlainTextPromptOptimization,
      runShortcutInlinePromptOptimization,
    });

    expect(runPlainTextPromptOptimization).toHaveBeenCalledTimes(1);
    expect(runKvStructuredPromptOptimization).not.toHaveBeenCalled();
    expect(runShortcutInlinePromptOptimization).not.toHaveBeenCalled();
  });

  it('routes non-KV shortcuts to the shortcut-inline flow only', async () => {
    const inlineTemplate = createShortcutTemplate('lemo');
    const runKvStructuredPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runPlainTextPromptOptimization = vi.fn().mockResolvedValue(undefined);
    const runShortcutInlinePromptOptimization = vi.fn().mockResolvedValue(undefined);

    expect(resolvePlaygroundPromptOptimizationFlow(inlineTemplate)).toBe('playground_shortcut_inline');

    await dispatchPlaygroundPromptOptimization({
      activeShortcutTemplate: inlineTemplate,
      runKvStructuredPromptOptimization,
      runPlainTextPromptOptimization,
      runShortcutInlinePromptOptimization,
    });

    expect(runShortcutInlinePromptOptimization).toHaveBeenCalledWith(inlineTemplate);
    expect(runKvStructuredPromptOptimization).not.toHaveBeenCalled();
    expect(runPlainTextPromptOptimization).not.toHaveBeenCalled();
  });
});
