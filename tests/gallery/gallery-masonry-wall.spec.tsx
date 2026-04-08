import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryMasonryWall } from '@/components/gallery/GalleryMasonryWall';
import type { GalleryActionHandlers, GalleryMoodboardData } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt || ''} {...props} />,
}));

vi.mock('@studio/playground/_components/AddToMoodboardMenu', () => ({
  AddToMoodboardMenu: () => <div data-testid="add-to-moodboard-menu" />,
}));

vi.mock('@/components/ui/tooltip-button', () => ({
  TooltipButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock('masonic', () => ({
  usePositioner: () => ({ }),
  useResizeObserver: () => ({ }),
  useInfiniteLoader: (callback: (...args: unknown[]) => Promise<void> | void) => callback,
  useMasonry: ({
    items,
    onRender,
  }: {
    items: unknown[];
    onRender?: (startIndex: number, stopIndex?: number) => void;
  }) => {
    onRender?.(0, Math.max(items.length - 1, 0));
    return <div data-testid="mock-masonry">{items.length}</div>;
  },
}));

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

let mockClientHeight = 0;
let mockClientWidth = 0;
let mockScrollHeight = 0;

function createGeneration(id: string): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/${id}.png`,
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

function createItem(raw: Generation) {
  return {
    id: raw.id,
    raw,
    displayUrl: raw.outputUrl || '',
    downloadUrl: raw.outputUrl || '',
    moodboardImagePath: raw.outputUrl || '',
    prompt: raw.config?.prompt || '',
    promptCategory: 'standard_generation' as const,
    promptCategoryLabel: '普通生成',
    model: raw.config?.model || 'Unknown Model',
    presetName: '',
    createdAt: raw.createdAt,
    width: raw.config?.width || 1024,
    height: raw.config?.height || 1024,
    imageLoadKey: `${raw.id}:${raw.outputUrl}`,
    searchText: (raw.config?.prompt || '').toLowerCase(),
    isPromptVisible: true,
    isImageVisible: true,
  };
}

const actions: GalleryActionHandlers = {
  onSelectItem: vi.fn(),
  onUsePrompt: vi.fn(),
  onUseImage: vi.fn(async () => undefined),
  onRerun: vi.fn(async () => undefined),
  onDownload: vi.fn(),
  onAddToMoodboard: vi.fn(),
};

const moodboardData: GalleryMoodboardData = {
  moodboards: [],
  moodboardCards: [],
  refreshMoodboardCards: vi.fn(async () => undefined),
};

describe('GalleryMasonryWall', () => {
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

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.getAttribute('data-testid') === 'gallery-scroll-container' ? mockClientWidth : 0;
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
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    }
    if (originalInnerHeight) {
      Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    }
    vi.unstubAllGlobals();
  });

  it('keeps an internal scroll container and triggers load-more from the masonry render range', async () => {
    mockClientHeight = 640;
    mockClientWidth = 1200;
    mockScrollHeight = 700;
    const onLoadMore = vi.fn(async () => undefined);

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('bounded-item'))]}
        layoutKey="recent"
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore
        onLoadMore={onLoadMore}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    const scrollContainer = screen.getByTestId('gallery-scroll-container');
    expect(scrollContainer.className).toContain('flex-1');
    expect(scrollContainer.className).toContain('min-h-0');

    await waitFor(() => {
      expect(scrollContainer.getAttribute('data-gallery-viewport-ready')).toBe('true');
    });

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the end indicator only after the wall has real overflowing content', async () => {
    mockClientHeight = 640;
    mockClientWidth = 1200;
    mockScrollHeight = 1600;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('end-item'))]}
        layoutKey="recent"
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn(async () => undefined)}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('End of Gallery')).toBeTruthy();
    });
  });
});
