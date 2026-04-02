import { describe, expect, it } from 'vitest';

import {
  buildBaseShortcutCodeFromStyleId,
  buildShortcutPayloadFromStyle,
  normalizeImagePaths,
  normalizeShortcutCodeSegment,
  resolveUniqueCode,
} from '../../scripts/lib/migrate-styles-to-shortcuts-utils.mjs';

describe('migrate-styles-to-shortcuts utils', () => {
  it('normalizes shortcut codes for style ids', () => {
    expect(normalizeShortcutCodeSegment('MB-中文__Style 01')).toBe('mb-style-01');
    expect(buildBaseShortcutCodeFromStyleId('ABC_123')).toBe('mb-abc-123');
  });

  it('normalizes and deduplicates image paths', () => {
    expect(normalizeImagePaths([
      ' /outputs/a.png ',
      '/outputs/a.png',
      '',
      'https://example.com/a.webp',
    ])).toEqual(['/outputs/a.png', 'https://example.com/a.webp']);
  });

  it('allocates unique codes by appending numeric suffixes', () => {
    const used = new Set<string>(['mb-demo', 'mb-demo-2']);
    const code = resolveUniqueCode('mb-demo', used);
    expect(code).toBe('mb-demo-3');
    expect(used.has('mb-demo-3')).toBe(true);
  });

  it('builds shortcut payload from a style record', () => {
    const payload = buildShortcutPayloadFromStyle({
      style: {
        id: 'style-001',
        name: '  Cozy  ',
        prompt: '  cozy setup  ',
        image_paths: ['/a.png', '/a.png', 'https://img.example/b.webp'],
      },
      code: 'mb-style-001',
      sortOrder: 12,
    });

    expect(payload.code).toBe('mb-style-001');
    expect(payload.name).toBe('Cozy');
    expect(payload.prompt_template).toBe('cozy setup');
    expect(payload.gallery_order).toEqual(['/a.png', 'https://img.example/b.webp']);
    expect(payload.cover_url).toBe('/a.png');
    expect(payload.sort_order).toBe(12);
    expect(payload.publish_status).toBe('published');
    expect(payload.is_enabled).toBe(true);
    expect(payload.prompt_config).toMatchObject({ sourceStyleId: 'style-001' });
  });
});
