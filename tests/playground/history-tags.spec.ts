import { describe, expect, it } from 'vitest';

import {
  buildHistoryTags,
  isHistoryEditGeneration,
  normalizeHistoryConfigForGeneration,
  withMoodboardTemplateMetadata,
} from '@/app/studio/playground/_lib/history-tags';
import type { GenerationConfig } from '@/types/database';

function createBaseConfig(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return {
    prompt: 'test prompt',
    width: 1024,
    height: 1024,
    model: 'coze_seedream4_5',
    ...overrides,
  };
}

function createEditConfig(originalImageUrl = 'https://example.com/source.png') {
  return {
    canvasJson: {},
    referenceImages: [],
    originalImageUrl,
    annotations: [],
    backgroundColor: 'transparent',
    canvasSize: { width: 1024, height: 1024 },
  };
}

describe('history tags helpers', () => {
  it('does not classify normal generation with stale editor fields as edit', () => {
    const config = createBaseConfig({
      imageEditorSession: {} as GenerationConfig['imageEditorSession'],
      tldrawSnapshot: { stale: true },
    });

    expect(isHistoryEditGeneration(config)).toBe(false);
    expect(buildHistoryTags(config).map((tag) => tag.label)).not.toContain('EDIT');

    const normalized = normalizeHistoryConfigForGeneration(config);
    expect(normalized.isEdit).toBe(false);
    expect(normalized.imageEditorSession).toBeUndefined();
    expect(normalized.tldrawSnapshot).toBeUndefined();
    expect(normalized.editConfig).toBeUndefined();
    expect(normalized.parentId).toBeUndefined();
  });

  it('classifies explicit edit generation as edit', () => {
    const config = createBaseConfig({
      isEdit: true,
      parentId: 'gen-parent',
      editConfig: createEditConfig(),
    });

    expect(isHistoryEditGeneration(config)).toBe(true);
    expect(buildHistoryTags(config).map((tag) => tag.label)).toContain('EDIT');
  });

  it('keeps compatibility for legacy edit records with parentId and originalImageUrl', () => {
    const config = createBaseConfig({
      isEdit: false,
      parentId: 'gen-parent',
      editConfig: createEditConfig(),
    });

    expect(isHistoryEditGeneration(config)).toBe(true);
    expect(normalizeHistoryConfigForGeneration(config).isEdit).toBe(true);
  });

  it('adds moodboard name tag for moodboard generation', () => {
    const config = createBaseConfig({
      moodboardTemplateId: 'shortcut-123',
      moodboardTemplateName: 'Street Campaign',
    });

    expect(buildHistoryTags(config).map((tag) => tag.label)).toContain('MOODBOARD: Street Campaign');
  });

  it('shows both moodboard and edit tags when both conditions match', () => {
    const config = createBaseConfig({
      moodboardTemplateName: 'Street Campaign',
      isEdit: true,
      parentId: 'gen-parent',
      editConfig: createEditConfig(),
    });

    const labels = buildHistoryTags(config).map((tag) => tag.label);
    expect(labels).toContain('MOODBOARD: Street Campaign');
    expect(labels).toContain('EDIT');
    expect(labels.indexOf('MOODBOARD: Street Campaign')).toBeLessThan(labels.indexOf('EDIT'));
  });

  it('does not classify banner generation as edit', () => {
    const config = createBaseConfig({
      generationMode: 'banner',
      isEdit: true,
      parentId: 'gen-parent',
      editConfig: createEditConfig(),
    });

    expect(isHistoryEditGeneration(config)).toBe(false);
    expect(buildHistoryTags(config).map((tag) => tag.label)).not.toContain('EDIT');

    const normalized = normalizeHistoryConfigForGeneration(config);
    expect(normalized.isEdit).toBe(false);
    expect(normalized.editConfig).toBeUndefined();
    expect(normalized.parentId).toBeUndefined();
  });

  it('sets and clears moodboard metadata with helper', () => {
    const withMetadata = withMoodboardTemplateMetadata(createBaseConfig(), {
      id: 'shortcut-123',
      name: 'Street Campaign',
    });
    expect(withMetadata.moodboardTemplateId).toBe('shortcut-123');
    expect(withMetadata.moodboardTemplateName).toBe('Street Campaign');

    const cleared = withMoodboardTemplateMetadata(withMetadata, null);
    expect(cleared.moodboardTemplateId).toBeUndefined();
    expect(cleared.moodboardTemplateName).toBeUndefined();
  });
});
