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

  it('includes published custom shortcuts outside the builtin shortcut set', () => {
    const runtimeShortcuts = buildRuntimePlaygroundShortcuts({
      persistedShortcuts: [
        {
          id: 'shortcut-row-custom',
          code: 'maorong',
          name: '毛绒',
          cover_subtitle: '毛绒玩偶风格',
          coverUrlResolved: 'https://example.com/covers/maorong.webp',
          galleryUrls: [
            'https://example.com/gallery/maorong-1.webp',
            'https://example.com/gallery/maorong-2.webp',
          ],
          model_id: 'seed4_v2_0226lemo',
          default_aspect_ratio: '3:4',
          default_width: 1792,
          default_height: 2400,
          prompt_template: 'Create a plush toy scene with {{subject}} and {{style}}',
          prompt_fields: [
            { key: 'subject', label: '主体', placeholder: '毛绒主角', type: 'text', order: 0 },
            { key: 'style', label: '风格', placeholder: '可爱治愈', type: 'text', order: 1 },
          ],
          moodboard_description: '毛绒质感定制模板',
        },
      ],
      modelLabelById: new Map([['seed4_v2_0226lemo', 'Seed 4.2 Lemo']]),
    });

    const shortcut = runtimeShortcuts.find((item) => item.id === 'maorong');
    expect(shortcut?.persistedId).toBe('shortcut-row-custom');
    expect(shortcut?.name).toBe('毛绒');
    expect(shortcut?.description).toBe('毛绒玩偶风格');
    expect(shortcut?.detailDescription).toBe('毛绒质感定制模板');
    expect(shortcut?.aspectRatio).toBe('3:4');
    expect(shortcut?.imageSize).toBe('2K');
    expect(shortcut?.imagePaths).toEqual([
      'https://example.com/gallery/maorong-1.webp',
      'https://example.com/gallery/maorong-2.webp',
    ]);
    expect(buildShortcutPrompt(shortcut!, {
      subject: 'cream bear mascot',
      style: 'soft studio lighting',
    })).toContain('cream bear mascot');
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
