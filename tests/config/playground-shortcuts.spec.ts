import { describe, expect, it } from 'vitest';

import {
  buildRuntimePlaygroundShortcuts,
  buildShortcutPrompt,
  getShortcutById,
  getShortcutMoodboardId,
  mergeShortcutMoodboards,
} from '@/config/playground-shortcuts';

describe('playground shortcut prompt builder', () => {
  it('preserves closing quotes around populated KV fields in the simplified KV template', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const result = buildShortcutPrompt(shortcut, {
      mainTitle: 'Spring Sale',
      subTitle: 'Up to 50% off',
      eventTime: '03.01 - 03.15',
      heroSubject: 'floating product box',
      style: 'cinematic poster',
      primaryColor: '#FF6B00',
    });

    expect(result).toContain('main title "Spring Sale"');
    expect(result).toContain('supporting title "Up to 50% off"');
    expect(result).toContain('event timing "03.01 - 03.15"');
    expect(result).toContain('featuring hero subject "floating product box"');
    expect(result).toContain('using #FF6B00');
    expect(result).not.toContain('as the dominant palette');
    expect(result).not.toContain('retail-ready commercial finish');
  });

  it('keeps the previous field closing quote when a middle KV field is removed', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const result = buildShortcutPrompt(
      shortcut,
      {
        mainTitle: 'Spring Sale',
        subTitle: 'Up to 50% off',
        eventTime: '03.01 - 03.15',
        heroSubject: 'floating product box',
        style: 'cinematic poster',
        primaryColor: '#FF6B00',
      },
      { removedFieldIds: ['subTitle'] }
    );

    expect(result).toContain('main title "Spring Sale", event timing "03.01 - 03.15"');
    expect(result).not.toContain('supporting title');
  });

  it('keeps the last visible field closed when trailing KV fields are removed', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const result = buildShortcutPrompt(
      shortcut,
      {
        mainTitle: 'Spring Sale',
        subTitle: 'Up to 50% off',
        eventTime: '03.01 - 03.15',
        heroSubject: 'floating product box',
        style: 'cinematic poster',
        primaryColor: '#FF6B00',
      },
      { removedFieldIds: ['style', 'primaryColor'] }
    );

    expect(result).toContain('featuring hero subject "floating product box"');
    expect(result).not.toContain('in cinematic poster');
    expect(result).not.toContain('using #FF6B00');
  });

  it('uses the simplified grid composer layout for all KV shortcuts', () => {
    expect(getShortcutById('us-kv')?.promptComposerLayout).toBe('grid');
    expect(getShortcutById('sea-kv')?.promptComposerLayout).toBe('grid');
    expect(getShortcutById('jp-kv')?.promptComposerLayout).toBe('grid');
  });

  it('builds runtime shortcuts from persisted shortcut metadata', () => {
    const runtimeShortcuts = buildRuntimePlaygroundShortcuts({
      persistedShortcuts: [
        {
          id: 'shortcut-row-1',
          code: 'lemo',
          name: 'Lemo Runtime',
          model_id: 'gemini-2.5-flash-image',
          prompt_template: 'Poster hero {{hero}} with accent {{accent}}',
          prompt_fields: [
            { key: 'hero', label: 'Hero', placeholder: '主体物', type: 'text', order: 0 },
            { key: 'accent', label: 'Accent', placeholder: '#FFAA00', type: 'color', order: 1 },
          ],
          moodboard_description: 'Runtime detail description',
        },
      ],
      modelLabelById: new Map([['gemini-2.5-flash-image', 'Nano banana']]),
    });

    const shortcut = runtimeShortcuts.find((item) => item.id === 'lemo');
    expect(shortcut?.persistedId).toBe('shortcut-row-1');
    expect(shortcut?.name).toBe('Lemo Runtime');
    expect(shortcut?.model).toBe('gemini-2.5-flash-image');
    expect(shortcut?.modelLabel).toBe('Nano banana');
    expect(shortcut?.detailDescription).toBe('Runtime detail description');
    expect(shortcut?.promptTemplate).toBe('Poster hero {{hero}} with accent {{accent}}');
    expect(shortcut?.fields.map((field) => field.id)).toEqual(['hero', 'accent']);
    expect(shortcut?.fields[1]?.type).toBe('color');
    expect(buildShortcutPrompt(shortcut!, { hero: 'toy bear', accent: '#FFAA00' })).toContain('toy bear');
  });

  it('preserves an explicit empty shortcut overlay image list', () => {
    const mergedMoodboards = mergeShortcutMoodboards([
      {
        id: getShortcutMoodboardId('lemo'),
        name: 'Legacy Lemo',
        prompt: 'Legacy prompt',
        imagePaths: [],
        updatedAt: '2026-03-27T00:00:00.000Z',
      },
    ]);

    const moodboard = mergedMoodboards.find((item) => item.id === getShortcutMoodboardId('lemo'));
    expect(moodboard?.imagePaths).toEqual([]);
  });
});
