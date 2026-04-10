import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getGalleryFeedLoadingState, useGalleryFeed } from '@/lib/gallery/use-gallery-feed';
import type { Generation } from '@/types/database';

const authState = {
  actorId: 'viewer-1',
  ensureSession: vi.fn(async () => 'viewer-1'),
};

const playgroundState = {
  generationHistory: [] as Generation[],
};

vi.mock('@/lib/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: typeof playgroundState) => unknown) => selector(playgroundState),
}));

function createGeneration(id: string, overrides: Partial<Generation> = {}): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `ljhwZthlaukjlkulzlp/gallery/${id}.png`,
    status: 'completed',
    createdAt: `2026-04-07T12:0${id.slice(-1)}:00.000Z`,
    config: {
      prompt: `Prompt ${id}`,
      width: 1024,
      height: 1024,
      model: id === 'gen-2' ? 'flux-dev' : 'coze_seedream4_5',
      presetName: id === 'gen-2' ? 'Product' : 'Portrait',
      ...(overrides.config || {}),
    },
    ...overrides,
  };
}

function createResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useGalleryFeed', () => {
  beforeEach(() => {
    authState.actorId = 'viewer-1';
    authState.ensureSession.mockClear();
    playgroundState.generationHistory = [];
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('loads pages, dedupes merged history, and prepends revalidated latest items', async () => {
    const page1 = [createGeneration('gen-1'), createGeneration('gen-2')];
    const page2 = [createGeneration('gen-2'), createGeneration('gen-3')];
    const latestPage = [createGeneration('gen-0'), createGeneration('gen-1')];
    let pageOneFetchCount = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input.toString(), window.location.origin);
      const page = url.searchParams.get('page');
      const viewerUserId = url.searchParams.get('viewerUserId');

      expect(viewerUserId).toBe('viewer-1');

      if (page === '1') {
        pageOneFetchCount += 1;
        return createResponse({
          history: pageOneFetchCount === 1 ? page1 : latestPage,
          hasMore: true,
        });
      }

      if (page === '2') {
        return createResponse({
          history: page2,
          hasMore: false,
        });
      }

      throw new Error(`Unexpected page ${page}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );

    const { result } = renderHook(() => useGalleryFeed({ sortBy: 'recent', isActive: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['gen-2', 'gen-1']);
    });

    expect(authState.ensureSession).toHaveBeenCalledTimes(1);
    expect(result.current.filterOptions.models).toEqual(['coze_seedream4_5', 'flux-dev']);
    expect(result.current.filterOptions.presets).toEqual(['Portrait', 'Product']);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['gen-3', 'gen-2', 'gen-1']);
    });
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.revalidateLatest();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['gen-3', 'gen-2', 'gen-1', 'gen-0']);
    });
  });

  it('does not fall back to the initial skeleton during retries after the first error', () => {
    expect(getGalleryFeedLoadingState({
      data: undefined,
      error: undefined,
      isValidating: true,
      size: 1,
    })).toMatchObject({
      isInitialLoading: true,
      isLoadingMore: false,
      isRefreshing: false,
    });

    expect(getGalleryFeedLoadingState({
      data: undefined,
      error: new Error('Failed to fetch gallery feed'),
      isValidating: true,
      size: 1,
    })).toMatchObject({
      isInitialLoading: false,
      isLoadingMore: false,
      isRefreshing: false,
    });
  });

  it('merges optimistic generation history into the gallery feed before server reconciliation', async () => {
    playgroundState.generationHistory = [
      {
        ...createGeneration('gen-local'),
        clientSyncState: 'syncing',
      },
    ];

    const fetchMock = vi.fn(async () => createResponse({
      history: [createGeneration('gen-1')],
      hasMore: false,
    }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );

    const { result } = renderHook(() => useGalleryFeed({ sortBy: 'recent', isActive: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['gen-1', 'gen-local']);
    });
  });

  it('prefers the server item when optimistic and persisted history share the same id', async () => {
    playgroundState.generationHistory = [
      {
        ...createGeneration('gen-1', {
          outputUrl: 'local-preview/gen-1.png',
          clientSyncState: 'syncing',
        }),
      },
    ];

    const persistedItem = createGeneration('gen-1', {
      outputUrl: 'persisted/gen-1.png',
    });

    const fetchMock = vi.fn(async () => createResponse({
      history: [persistedItem],
      hasMore: false,
    }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );

    const { result } = renderHook(() => useGalleryFeed({ sortBy: 'recent', isActive: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('gen-1');
      expect(result.current.items[0].moodboardImagePath).toBe('persisted/gen-1.png');
      expect(result.current.items[0].raw.clientSyncState).toBeUndefined();
    });
  });

  it('pauses fetches and manual paging when the gallery is inactive', async () => {
    playgroundState.generationHistory = [
      {
        ...createGeneration('gen-local'),
        clientSyncState: 'syncing',
      },
    ];

    const fetchMock = vi.fn(async () => createResponse({
      history: [createGeneration('gen-1')],
      hasMore: true,
    }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );

    const { result } = renderHook(() => useGalleryFeed({ sortBy: 'recent', isActive: false }), { wrapper });

    await waitFor(() => {
      expect(authState.ensureSession).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadMore();
      await result.current.revalidateLatest();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.items.map((item) => item.id)).toEqual(['gen-local']);
  });
});
