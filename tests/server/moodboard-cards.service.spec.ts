import { describe, expect, it } from 'vitest';

import { classifyMoodboardCardGalleryItem } from '@/lib/server/service/moodboard-cards.service';

describe('classifyMoodboardCardGalleryItem', () => {
  it('passes through absolute urls and site-relative paths', () => {
    expect(classifyMoodboardCardGalleryItem('https://example.com/a.webp')).toEqual({
      kind: 'passthrough',
      value: 'https://example.com/a.webp',
    });

    expect(classifyMoodboardCardGalleryItem('/outputs/a.webp')).toEqual({
      kind: 'passthrough',
      value: '/outputs/a.webp',
    });
  });

  it('classifies storage keys for signing', () => {
    expect(classifyMoodboardCardGalleryItem('moodboard-cards/gallery/a.webp')).toEqual({
      kind: 'storage_key',
      value: 'moodboard-cards/gallery/a.webp',
    });
  });

  it('skips empty values and keeps non-empty plain values as passthrough', () => {
    expect(classifyMoodboardCardGalleryItem('')).toEqual({
      kind: 'skip',
      value: '',
    });

    expect(classifyMoodboardCardGalleryItem('legacy_asset_id')).toEqual({
      kind: 'passthrough',
      value: 'legacy_asset_id',
    });
  });
});
