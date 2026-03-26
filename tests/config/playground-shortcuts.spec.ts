import { describe, expect, it } from 'vitest';

import { buildShortcutPrompt, getShortcutById } from '@/config/playground-shortcuts';

describe('playground shortcut prompt builder', () => {
  it('preserves closing quotes around populated KV fields and keeps the final suffix text', () => {
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
    expect(result).toContain('using #FF6B00 as the dominant palette');
    expect(result).toContain('retail-ready commercial finish');
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
});
