import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GalleryView from '@/app/studio/playground/_components/GalleryView';
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

vi.mock('@studio/playground/_components/gallery/GalleryImageWall', () => ({
  GalleryImageWall: ({
    isInitialLoading,
    items,
  }: {
    isInitialLoading: boolean;
    items: Generation[];
  }) => (
    <div data-testid={isInitialLoading ? 'gallery-wall-loading' : 'gallery-wall-ready'}>
      {items.length}
    </div>
  ),
}));

const storeState = {
  galleryItems: [] as Generation[],
  fetchGallery: vi.fn(async () => undefined),
  syncGalleryLatest: vi.fn(async () => undefined),
  prefetchGalleryNext: vi.fn(async () => undefined),
  galleryPage: 1,
  hasMoreGallery: true,
  isFetchingGallery: false,
  activeTab: 'gallery' as const,
  gallerySortBy: 'recent' as const,
  setGallerySortBy: vi.fn(),
  applyPrompt: vi.fn(),
};

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
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

describe('GalleryView loading behavior', () => {
  beforeEach(() => {
    storeState.fetchGallery.mockClear();
    storeState.syncGalleryLatest.mockClear();
    storeState.prefetchGalleryNext.mockClear();
    storeState.setGallerySortBy.mockClear();
    storeState.applyPrompt.mockClear();
  });

  it('keeps cached gallery items visible while a background fetch is in flight', () => {
    storeState.galleryItems = [createGeneration('cached-item')];
    storeState.isFetchingGallery = true;

    render(<GalleryView />);

    expect(screen.getByTestId('gallery-wall-ready')).toBeTruthy();
    expect(screen.queryByTestId('gallery-wall-loading')).toBeNull();
  });

  it('keeps the gallery content inside a bounded flex chain', () => {
    storeState.galleryItems = [createGeneration('bounded-item')];
    storeState.isFetchingGallery = false;

    render(<GalleryView />);

    expect(screen.getByTestId('gallery-view-root').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-root').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-shell').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-shell').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-stack').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-stack').className).toContain('min-h-0');
    expect(screen.getByTestId('gallery-view-body').className).toContain('flex-1');
    expect(screen.getByTestId('gallery-view-body').className).toContain('min-h-0');
  });
});
