import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryMasonryWall } from '@/components/gallery/GalleryMasonryWall';
import type { GalleryActionHandlers, GalleryMoodboardData } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

interface MockUsePositionerConfig {
  width: number;
  columnWidth: number;
  columnGutter: number;
  rowGutter: number;
  maxColumnCount: number;
}

interface MockUseMasonryConfig {
  items: unknown[];
  onRender?: (startIndex: number, stopIndex?: number) => void;
  className?: string;
}

const { resizeObserverCallbacks, usePositionerMock, useMasonryMock } = vi.hoisted(() => ({
  resizeObserverCallbacks: new Set<ResizeObserverCallback>(),
  usePositionerMock: vi.fn((_: MockUsePositionerConfig, __?: readonly unknown[]) => ({})),
  useMasonryMock: vi.fn(({
    items,
    onRender,
    className,
  }: MockUseMasonryConfig) => {
    onRender?.(0, Math.max(items.length - 1, 0));
    return <div data-testid="mock-masonry" className={className}>{items.length}</div>;
  }),
}));

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
  usePositioner: (config: MockUsePositionerConfig, deps?: readonly unknown[]) => usePositionerMock(config, deps),
  useResizeObserver: () => ({}),
  useInfiniteLoader: (callback: (...args: unknown[]) => Promise<void> | void) => callback,
  useMasonry: (config: MockUseMasonryConfig) => useMasonryMock(config),
}));

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverCallbacks.add(callback);
  }

  observe() {}

  disconnect() {
    resizeObserverCallbacks.delete(this.callback);
  }

  unobserve() {}
}

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

let mockClientHeight = 0;
let mockScrollClientWidth = 0;
let mockMasonryClientWidth = 0;
let mockMasonryClientHeight = 0;
let mockScrollHeight = 0;
let nextFrameId = 1;
const frameTimers = new Map<number, number>();

function triggerResizeObservers() {
  resizeObserverCallbacks.forEach((callback) => {
    callback([], {} as ResizeObserver);
  });
}

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
    usePositionerMock.mockClear();
    useMasonryMock.mockClear();
    resizeObserverCallbacks.clear();
    frameTimers.forEach((timer) => window.clearTimeout(timer));
    frameTimers.clear();
    nextFrameId = 1;

    vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      const frameId = nextFrameId++;
      const timer = window.setTimeout(() => {
        frameTimers.delete(frameId);
        callback(0);
      }, 0);
      frameTimers.set(frameId, timer);
      return frameId;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', ((frameId: number) => {
      const timer = frameTimers.get(frameId);
      if (timer === undefined) {
        return;
      }
      window.clearTimeout(timer);
      frameTimers.delete(frameId);
    }) as typeof cancelAnimationFrame);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1440,
    });

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        const testId = this.getAttribute('data-testid');
        if (testId === 'gallery-scroll-container') {
          return mockClientHeight;
        }
        if (testId === 'gallery-masonry-container') {
          return mockMasonryClientHeight;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        const testId = this.getAttribute('data-testid');
        if (testId === 'gallery-scroll-container') {
          return mockScrollClientWidth;
        }
        if (testId === 'gallery-masonry-container') {
          return mockMasonryClientWidth;
        }
        return 0;
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
    if (originalInnerWidth) {
      Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    }
    frameTimers.forEach((timer) => window.clearTimeout(timer));
    frameTimers.clear();
    vi.unstubAllGlobals();
  });

  it('keeps an internal scroll container and triggers load-more from the masonry render range', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1200;
    mockMasonryClientWidth = 1120;
    mockMasonryClientHeight = 680;
    mockScrollHeight = 700;
    const onLoadMore = vi.fn(async () => undefined);

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('bounded-item'))]}
        layoutKey="recent"
        isActive
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
    expect(scrollContainer.className).toContain('min-w-0');

    await waitFor(() => {
      expect(scrollContainer.getAttribute('data-gallery-viewport-ready')).toBe('true');
    });

    const masonryContainer = screen.getByTestId('gallery-masonry-container');
    expect(masonryContainer.className).toContain('w-full');
    expect(masonryContainer.className).toContain('min-w-0');
    expect(screen.getByTestId('gallery-masonry-grid-shell').className).toContain('w-full');

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1120,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it('does not trigger load-more while the keep-alive gallery is inactive', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1200;
    mockMasonryClientWidth = 1120;
    mockMasonryClientHeight = 680;
    mockScrollHeight = 700;
    const onLoadMore = vi.fn(async () => undefined);

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('inactive-item'))]}
        layoutKey="recent"
        isActive={false}
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore
        onLoadMore={onLoadMore}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('gallery-scroll-container').getAttribute('data-gallery-viewport-ready')).toBe('true');
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows the end indicator only after the wall has real overflowing content', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1200;
    mockMasonryClientWidth = 1120;
    mockMasonryClientHeight = 1600;
    mockScrollHeight = 1600;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('end-item'))]}
        layoutKey="recent"
        isActive
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

  it('rebuilds the positioner when the masonry width changes inside the same breakpoint', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1260;
    mockMasonryClientWidth = 1180;
    mockMasonryClientHeight = 1700;
    mockScrollHeight = 1700;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('resize-item'))]}
        layoutKey="recent"
        isActive
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn(async () => undefined)}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1180,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });

    mockScrollClientWidth = 1220;
    mockMasonryClientWidth = 1140;
    act(() => {
      triggerResizeObservers();
    });

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1140,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });
  });

  it('does not rebuild the positioner when only the masonry height changes', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1260;
    mockMasonryClientWidth = 1180;
    mockMasonryClientHeight = 1700;
    mockScrollHeight = 1700;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('height-item'))]}
        layoutKey="recent"
        isActive
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn(async () => undefined)}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1180,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });

    const positionerCallCount = usePositionerMock.mock.calls.length;

    mockMasonryClientHeight = 1960;
    act(() => {
      triggerResizeObservers();
    });

    await waitFor(() => {
      expect(usePositionerMock.mock.calls.length).toBe(positionerCallCount);
    });
  });

  it('keeps the last stable width when the masonry container briefly reports zero width', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1260;
    mockMasonryClientWidth = 1180;
    mockMasonryClientHeight = 1700;
    mockScrollHeight = 1700;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('stable-width-item'))]}
        layoutKey="recent"
        isActive
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn(async () => undefined)}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1180,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });

    const positionerCallCount = usePositionerMock.mock.calls.length;

    mockMasonryClientWidth = 0;
    act(() => {
      triggerResizeObservers();
    });

    await waitFor(() => {
      expect(usePositionerMock.mock.calls.length).toBe(positionerCallCount);
    });
  });

  it('falls back to the window width before the masonry width is measured', async () => {
    mockClientHeight = 640;
    mockScrollClientWidth = 1260;
    mockMasonryClientWidth = 0;
    mockMasonryClientHeight = 1700;
    mockScrollHeight = 1700;

    render(
      <GalleryMasonryWall
        items={[createItem(createGeneration('fallback-width-item'))]}
        layoutKey="recent"
        isActive
        isInitialLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn(async () => undefined)}
        actions={actions}
        moodboardData={moodboardData}
      />,
    );

    await waitFor(() => {
      const latestCall = usePositionerMock.mock.calls.at(-1);
      expect(latestCall?.[0]).toMatchObject({
        width: 1440,
        columnWidth: 170,
        maxColumnCount: 8,
      });
    });
  });

});
