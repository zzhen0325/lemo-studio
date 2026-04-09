import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GalleryView from '@/app/studio/playground/_components/GalleryView';
import type { GalleryFeedResult, GalleryItemViewModel } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/ui/split-text', () => ({
  default: ({ text, className }: { text: string; className?: string }) => (
    <span className={className}>{text}</span>
  ),
}));

vi.mock('@studio/playground/_components/hooks/useGenerationService', () => ({
  useGenerationService: () => ({
    handleGenerate: vi.fn(async () => undefined),
  }),
}));

vi.mock('@studio/playground/_components/hooks/usePlaygroundMoodboards', () => ({
  usePlaygroundMoodboards: () => ({
    moodboards: [],
    moodboardCards: [],
    refreshMoodboardCards: vi.fn(async () => undefined),
  }),
}));

vi.mock('@/components/gallery/GalleryMasonryWall', () => ({
  GalleryMasonryWall: ({ items, layoutKey }: { items: unknown[]; layoutKey: string }) => (
    <div data-testid="gallery-wall-ready" data-layout-key={layoutKey}>{items.length}</div>
  ),
}));

vi.mock('@/components/gallery/GalleryPromptGrid', () => ({
  GalleryPromptGrid: ({ items }: { items: unknown[] }) => (
    <div data-testid="gallery-prompt-grid">{items.length}</div>
  ),
}));

const feedState: GalleryFeedResult = {
  items: [] as never[],
  promptItems: [] as never[],
  filterOptions: {
    models: [],
    presets: [],
  },
  hasMore: true,
  isInitialLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  loadMore: vi.fn(async () => undefined),
  revalidateLatest: vi.fn(async () => undefined),
};

const useGalleryFeedMock = vi.fn((options: { sortBy: string }) => {
  void options;
  return feedState;
});

vi.mock('@/lib/gallery/use-gallery-feed', () => ({
  useGalleryFeed: (options: { sortBy: string }) => useGalleryFeedMock(options),
}));

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: {
    getState: () => ({
      applyPrompt: vi.fn(),
      applyImage: vi.fn(async () => undefined),
      applyImages: vi.fn(async () => undefined),
      setUploadedImages: vi.fn(),
      applyModel: vi.fn(),
      setSelectedPresetName: vi.fn(),
      setViewMode: vi.fn(),
      setActiveTab: vi.fn(),
      config: {
        prompt: '',
        width: 1024,
        height: 1024,
        model: 'coze_seedream4_5',
      },
    }),
  },
}));

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
      height: 1024,
      model: 'coze_seedream4_5',
    },
  };
}

function createViewModel(id: string): GalleryItemViewModel {
  const raw = createGeneration(id);

  return {
    id: raw.id,
    raw,
    displayUrl: raw.outputUrl || '',
    downloadUrl: raw.outputUrl || '',
    moodboardImagePath: raw.outputUrl || '',
    prompt: raw.config?.prompt || '',
    promptCategory: 'standard_generation',
    promptCategoryLabel: '普通生成',
    model: raw.config?.model || 'Unknown Model',
    presetName: raw.config?.presetName || '',
    createdAt: raw.createdAt,
    width: raw.config?.width || 1024,
    height: raw.config?.height || 1024,
    imageLoadKey: `${raw.id}:${raw.outputUrl}`,
    searchText: (raw.config?.prompt || '').toLowerCase(),
    isPromptVisible: true,
    isImageVisible: true,
  };
}

describe('GalleryView loading behavior', () => {
  beforeEach(() => {
    useGalleryFeedMock.mockClear();
    feedState.loadMore = vi.fn(async () => undefined);
    feedState.revalidateLatest = vi.fn(async () => undefined);
  });

  it('uses the shared gallery feed hook with the default recent sort', () => {
    feedState.items = [createViewModel('cached-item')];
    feedState.promptItems = [createViewModel('cached-item')];
    feedState.isInitialLoading = false;

    render(<GalleryView />);

    expect(screen.getByTestId('gallery-wall-ready')).toBeTruthy();
    expect(useGalleryFeedMock).toHaveBeenCalledWith({ sortBy: 'recent' });
  });

  it('keeps the gallery content inside a bounded flex chain', () => {
    feedState.items = [createViewModel('bounded-item')];
    feedState.promptItems = [createViewModel('bounded-item')];
    feedState.isInitialLoading = false;

    render(<GalleryView />);

    expect(screen.getByTestId('gallery-view-root').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-root').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-root').className).toContain('min-w-0');
    expect(screen.getByTestId('gallery-view-shell').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-shell').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-shell').className).toContain('min-w-0');
    expect(screen.getByTestId('gallery-view-stack').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-stack').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-stack').className).toContain('min-w-0');
    expect(screen.getByTestId('gallery-view-body').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-body').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-body').className).toContain('min-w-0');
  });

  it('keeps the masonry layout key stable when the first gallery item changes', () => {
    feedState.items = [createViewModel('first-item-a'), createViewModel('first-item-b')];
    feedState.promptItems = [createViewModel('first-item-a'), createViewModel('first-item-b')];
    feedState.isInitialLoading = false;

    const { rerender } = render(<GalleryView />);
    const initialLayoutKey = screen.getByTestId('gallery-wall-ready').getAttribute('data-layout-key');

    feedState.items = [createViewModel('first-item-c'), createViewModel('first-item-b')];
    feedState.promptItems = [createViewModel('first-item-c'), createViewModel('first-item-b')];
    rerender(<GalleryView />);

    expect(screen.getByTestId('gallery-wall-ready').getAttribute('data-layout-key')).toBe(initialLayoutKey);
  });
});
