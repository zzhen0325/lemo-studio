import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HistoryList from '@/app/studio/playground/_components/HistoryList';
import type { Generation } from '@/types/database';

const groupedHistoryMock = vi.fn();
const mountCountById = new Map<string, number>();
const unmountCountById = new Map<string, number>();
let currentGroupedHistory: Array<{ type: string; key: string; items: Generation[]; startAt: string }> = [];

const storeState = {
  setPreviewImage: vi.fn(),
  isSelectionMode: false,
  setIsSelectionMode: vi.fn(),
  selectedHistoryIds: new Set<string>(),
  toggleHistorySelection: vi.fn(),
  clearHistorySelection: vi.fn(),
  deleteHistory: vi.fn(),
};

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('@studio/playground/_components/hooks/usePlaygroundMoodboards', () => ({
  usePlaygroundMoodboards: () => ({
    moodboards: [],
    moodboardCards: [],
    refreshMoodboardCards: vi.fn(async () => undefined),
  }),
}));

vi.mock('@studio/playground/_components/hooks/useGroupedHistory', () => ({
  useGroupedHistory: () => groupedHistoryMock(),
  isTextHistoryResult: () => false,
}));

vi.mock('@studio/playground/_components/history/HistoryCards', () => ({
  DescribeSourceImage: () => <div data-testid="describe-source-image" />,
  DraggableHistoryCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HistoryCard: ({ result }: { result: Generation }) => {
    React.useEffect(() => {
      mountCountById.set(result.id, (mountCountById.get(result.id) || 0) + 1);
      return () => {
        unmountCountById.set(result.id, (unmountCountById.get(result.id) || 0) + 1);
      };
    }, []);

    return <div data-testid={`history-card-${result.id}`}>{result.id}</div>;
  },
  TextHistoryCard: ({ result }: { result: Generation }) => <div data-testid={`text-history-card-${result.id}`}>{result.id}</div>,
}));

function createGeneration(id: string): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `upload/${id}.png`,
    status: 'completed',
    createdAt: `2026-04-05T00:00:0${id === 'a' ? '1' : id === 'b' ? '2' : '3'}.000Z`,
    config: {
      prompt: `Prompt ${id}`,
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
    },
  };
}

describe('HistoryList group key stability', () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
    vi.useFakeTimers();
    groupedHistoryMock.mockReset();
    currentGroupedHistory = [];
    groupedHistoryMock.mockImplementation(() => currentGroupedHistory);
    mountCountById.clear();
    unmountCountById.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps existing groups mounted when a new group is prepended', () => {
    const genA = createGeneration('a');
    const genB = createGeneration('b');
    const genX = createGeneration('x');

    currentGroupedHistory = [
      { type: 'image', key: 'task|a|image', items: [genA], startAt: genA.createdAt },
      { type: 'image', key: 'task|b|image', items: [genB], startAt: genB.createdAt },
    ];

    const baseProps = {
      onRegenerate: vi.fn(),
      onDownload: vi.fn(),
      onEdit: vi.fn(),
      onImageClick: vi.fn(),
      onUsePrompt: vi.fn(),
      onBatchUse: vi.fn(),
      onLayoutModeChange: vi.fn(),
      onLoadMore: vi.fn(),
      onClose: vi.fn(),
      hasMore: false,
      isLoading: false,
      variant: 'sidebar' as const,
      layoutMode: 'list' as const,
    };

    const { rerender } = render(
      <HistoryList
        history={[genA, genB]}
        {...baseProps}
      />
    );

    expect(mountCountById.get('a')).toBe(1);
    expect(mountCountById.get('b')).toBe(1);

    currentGroupedHistory = [
      { type: 'image', key: 'task|x|image', items: [genX], startAt: genX.createdAt },
      { type: 'image', key: 'task|a|image', items: [genA], startAt: genA.createdAt },
      { type: 'image', key: 'task|b|image', items: [genB], startAt: genB.createdAt },
    ];

    rerender(
      <HistoryList
        history={[genX, genA, genB]}
        {...baseProps}
      />
    );

    expect(mountCountById.get('a')).toBe(1);
    expect(unmountCountById.get('a') || 0).toBe(0);
  });

  it('does not replace existing history with the initial loading skeleton during refresh', () => {
    const genA = createGeneration('a');
    currentGroupedHistory = [
      { type: 'image', key: 'task|a|image', items: [genA], startAt: genA.createdAt },
    ];

    render(
      <HistoryList
        history={[genA]}
        onRegenerate={vi.fn()}
        onDownload={vi.fn()}
        onEdit={vi.fn()}
        onImageClick={vi.fn()}
        onUsePrompt={vi.fn()}
        onBatchUse={vi.fn()}
        onLayoutModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onClose={vi.fn()}
        hasMore
        isLoading
        isLoadingMore={false}
        variant="sidebar"
        layoutMode="list"
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('history-card-a')).toBeTruthy();
    expect(screen.queryByText('Loading more...')).toBeNull();
  });

  it('shows bottom loading indicator only when paginating', () => {
    const genA = createGeneration('a');
    currentGroupedHistory = [
      { type: 'image', key: 'task|a|image', items: [genA], startAt: genA.createdAt },
    ];

    render(
      <HistoryList
        history={[genA]}
        onRegenerate={vi.fn()}
        onDownload={vi.fn()}
        onEdit={vi.fn()}
        onImageClick={vi.fn()}
        onUsePrompt={vi.fn()}
        onBatchUse={vi.fn()}
        onLayoutModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onClose={vi.fn()}
        hasMore
        isLoading={false}
        isLoadingMore
        variant="sidebar"
        layoutMode="list"
      />
    );

    expect(screen.getByText('Loading more...')).toBeTruthy();
    expect(screen.getByTestId('history-card-a')).toBeTruthy();
  });
});
