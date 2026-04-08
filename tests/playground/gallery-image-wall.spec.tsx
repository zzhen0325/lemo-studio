import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryImageWall } from '@/app/studio/playground/_components/gallery/GalleryImageWall';
import type { Generation } from '@/types/database';

vi.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/app/studio/playground/_components/gallery/GalleryImageCard', () => ({
  GalleryImageCard: ({ item }: { item: Generation }) => <div data-testid={`gallery-image-card-${item.id}`}>{item.id}</div>,
}));

vi.mock('@/app/studio/playground/_components/gallery/VirtualizedGalleryMasonry', () => ({
  VirtualizedGalleryMasonry: ({ items }: { items: Generation[] }) => (
    <div data-testid="virtualized-gallery-grid">{items.length}</div>
  ),
}));

vi.mock('@/app/studio/playground/_components/gallery/use-gallery-container-width', () => ({
  useGalleryContainerWidth: () => ({
    width: 1200,
    columnsCount: 6,
  }),
}));

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
let mockClientHeight = 0;
let mockScrollHeight = 0;

function createGeneration(id: string): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `/images/${id}.png`,
    status: 'completed',
    createdAt: '2026-04-07T12:00:00.000Z',
    config: {
      prompt: `Prompt ${id}`,
      width: 1024,
      height: 1400,
      model: 'coze_seedream4_5',
    },
  };
}

describe('GalleryImageWall viewport readiness', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return this.getAttribute('data-testid') === 'gallery-scroll-container' ? mockClientHeight : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return this.getAttribute('data-testid') === 'gallery-scroll-container' ? mockScrollHeight : 0;
      },
    });
  });

  afterEach(() => {
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    }

    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    }

    if (originalInnerHeight) {
      Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    }

    vi.unstubAllGlobals();
  });

  it('does not auto-fill when the scroll container has not settled into a bounded viewport', async () => {
    mockClientHeight = 1120;
    mockScrollHeight = 1180;
    const onLoadMore = vi.fn();

    render(
      <GalleryImageWall
        items={[createGeneration('unbounded-item')]}
        layoutKey="recent"
        isInitialLoading={false}
        isFetchingGallery={false}
        hasMoreGallery
        onLoadMore={onLoadMore}
        onDownload={vi.fn()}
        onGenerate={vi.fn(async () => undefined)}
        moodboards={[]}
        moodboardCards={[]}
        refreshMoodboardCards={vi.fn(async () => undefined)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('gallery-scroll-container').getAttribute('data-gallery-viewport-ready')).toBe('false');
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('allows auto-fill once the scroll container has a real bounded viewport', async () => {
    mockClientHeight = 640;
    mockScrollHeight = 700;
    const onLoadMore = vi.fn();

    render(
      <GalleryImageWall
        items={[createGeneration('bounded-item')]}
        layoutKey="recent"
        isInitialLoading={false}
        isFetchingGallery={false}
        hasMoreGallery
        onLoadMore={onLoadMore}
        onDownload={vi.fn()}
        onGenerate={vi.fn(async () => undefined)}
        moodboards={[]}
        moodboardCards={[]}
        refreshMoodboardCards={vi.fn(async () => undefined)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('gallery-scroll-container').getAttribute('data-gallery-viewport-ready')).toBe('true');
    });

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });
});
