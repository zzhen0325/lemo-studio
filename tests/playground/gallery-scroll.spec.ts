import { describe, expect, it } from 'vitest';

import {
  getGalleryLoadMoreThreshold,
  hasGalleryOverflow,
  isGalleryViewportReady,
  shouldAutoFillGallery,
  shouldLoadMoreGallery,
  shouldShowGalleryEndIndicator,
} from '@/app/studio/playground/_components/gallery/gallery-scroll';

describe('gallery-scroll helpers', () => {
  it('caps the load-more threshold within a predictable range', () => {
    expect(getGalleryLoadMoreThreshold(200)).toBe(240);
    expect(getGalleryLoadMoreThreshold(900)).toBe(315);
    expect(getGalleryLoadMoreThreshold(2200)).toBe(480);
  });

  it('autofills when the wall still cannot overflow the viewport', () => {
    expect(shouldAutoFillGallery(1000, 900)).toBe(true);
    expect(shouldAutoFillGallery(1300, 900)).toBe(false);
  });

  it('does not eagerly paginate a wall that already overflows before the user scrolls', () => {
    expect(
      shouldLoadMoreGallery({
        scrollHeight: 1600,
        scrollTop: 0,
        clientHeight: 900,
        hasUserScrolled: false,
      }),
    ).toBe(false);
  });

  it('loads more after the user reaches the bottom threshold', () => {
    expect(
      shouldLoadMoreGallery({
        scrollHeight: 2100,
        scrollTop: 930,
        clientHeight: 900,
        hasUserScrolled: true,
      }),
    ).toBe(true);
  });

  it('only shows the end indicator after the wall can meaningfully reach the bottom', () => {
    expect(
      shouldShowGalleryEndIndicator({
        hasMoreGallery: false,
        itemsLength: 12,
        hasOverflowingContent: false,
        hasUserScrolled: false,
      }),
    ).toBe(false);

    expect(
      shouldShowGalleryEndIndicator({
        hasMoreGallery: false,
        itemsLength: 12,
        hasOverflowingContent: true,
        hasUserScrolled: false,
      }),
    ).toBe(true);
  });

  it('detects whether the gallery can really overflow', () => {
    expect(hasGalleryOverflow(1000, 980)).toBe(false);
    expect(hasGalleryOverflow(1050, 980)).toBe(true);
  });

  it('requires a bounded viewport before auto-fill logic can run', () => {
    expect(
      isGalleryViewportReady({
        clientHeight: 0,
        containerWidth: 1200,
        windowHeight: 900,
      }),
    ).toBe(false);

    expect(
      isGalleryViewportReady({
        clientHeight: 160,
        containerWidth: 1200,
        windowHeight: 900,
      }),
    ).toBe(false);

    expect(
      isGalleryViewportReady({
        clientHeight: 620,
        containerWidth: 1200,
        windowHeight: 900,
      }),
    ).toBe(true);

    expect(
      isGalleryViewportReady({
        clientHeight: 1040,
        containerWidth: 1200,
        windowHeight: 900,
      }),
    ).toBe(false);
  });
});
