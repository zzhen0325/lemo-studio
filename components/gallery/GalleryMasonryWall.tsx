"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useInfiniteLoader, useMasonry, usePositioner, useResizeObserver } from 'masonic';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  hasGalleryOverflow,
  isGalleryViewportReady,
  shouldShowGalleryEndIndicator,
} from '@/lib/gallery/scroll-helpers';
import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import { GalleryImageCard } from './GalleryImageCard';

function getGalleryColumnsCount(containerWidth: number) {
  if (containerWidth >= 1536) return 8;
  if (containerWidth >= 1280) return 7;
  if (containerWidth >= 1024) return 6;
  if (containerWidth >= 768) return 5;
  if (containerWidth >= 640) return 3;
  return 1;
}

function useScrollViewport(scrollContainerRef: RefObject<HTMLDivElement>) {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    scrollTop: 0,
    isScrolling: false,
  });
  const scrollingTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;
    const updateViewport = () => {
      frameId = 0;
      setViewport((current) => {
        const next = {
          width: element.clientWidth,
          height: element.clientHeight,
          scrollTop: element.scrollTop,
          isScrolling: current.isScrolling,
        };

        if (
          current.width === next.width
          && current.height === next.height
          && current.scrollTop === next.scrollTop
          && current.isScrolling === next.isScrolling
        ) {
          return current;
        }

        return next;
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(updateViewport);
    };

    const handleScroll = () => {
      setViewport((current) => current.isScrolling ? current : { ...current, isScrolling: true });

      if (scrollingTimeoutRef.current !== null) {
        window.clearTimeout(scrollingTimeoutRef.current);
      }

      scrollingTimeoutRef.current = window.setTimeout(() => {
        setViewport((current) => current.isScrolling ? { ...current, isScrolling: false } : current);
      }, 120);

      scheduleUpdate();
    };

    scheduleUpdate();
    element.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      if (scrollingTimeoutRef.current !== null) {
        window.clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, [scrollContainerRef]);

  return viewport;
}

function GallerySkeletonGrid({ columnsCount }: { columnsCount: number }) {
  const cols = Math.max(columnsCount, 1);

  return (
    <div data-testid="gallery-skeleton-grid" className="flex w-full gap-[1px]">
      {Array.from({ length: cols }).map((_, colIdx) => (
        <div key={`gallery-skeleton-col-${colIdx}`} className="flex min-w-0 flex-1 flex-col gap-[1px]">
          {Array.from({ length: 3 }).map((__, itemIdx) => (
            <div
              key={`gallery-skeleton-item-${colIdx}-${itemIdx}`}
              className="animate-pulse rounded-xl border border-white/10 bg-white/5"
              style={{
                paddingBottom: `${itemIdx % 3 === 0 ? 140 : itemIdx % 3 === 1 ? 120 : 160}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface GalleryMasonryWallProps {
  items: GalleryItemViewModel[];
  layoutKey: string;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  actions: GalleryActionHandlers;
  moodboardData: GalleryMoodboardData;
  allItems?: import('@/types/database').Generation[];
}

export function GalleryMasonryWall({
  items,
  layoutKey,
  isInitialLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  actions,
  moodboardData,
  allItems,
}: GalleryMasonryWallProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const viewport = useScrollViewport(scrollContainerRef);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [hasOverflowingContent, setHasOverflowingContent] = useState(false);
  const columnsCount = getGalleryColumnsCount(viewport.width);
  const isViewportReady = isGalleryViewportReady({
    clientHeight: viewport.height,
    containerWidth: viewport.width,
    windowHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
  });

  const positioner = usePositioner(
    {
      width: viewport.width,
      columnCount: columnsCount,
      columnGutter: 1,
      rowGutter: 1,
    },
    [columnsCount, layoutKey],
  );
  const resizeObserver = useResizeObserver(positioner);
  const inflightLoadMoreRef = useRef(false);

  const maybeLoadMore = useInfiniteLoader(
    useCallback(async () => {
      if (!isViewportReady || !hasMore || isLoadingMore || inflightLoadMoreRef.current) {
        return;
      }

      inflightLoadMoreRef.current = true;
      try {
        await onLoadMore();
      } finally {
        inflightLoadMoreRef.current = false;
      }
    }, [hasMore, isLoadingMore, isViewportReady, onLoadMore]),
    {
      minimumBatchSize: Math.max(columnsCount, 1),
      threshold: Math.max(columnsCount * 2, 8),
      totalItems: hasMore ? items.length + 1 : items.length,
    },
  );

  const renderMasonryCell = useCallback(
    ({ data }: { index: number; width: number; data: GalleryItemViewModel }) => (
      <GalleryImageCard
        item={data}
        actions={actions}
        moodboardData={moodboardData}
        allItems={allItems}
      />
    ),
    [actions, allItems, moodboardData],
  );

  const masonry = useMasonry({
    items,
    positioner,
    resizeObserver,
    height: viewport.height,
    scrollTop: viewport.scrollTop,
    isScrolling: viewport.isScrolling,
    overscanBy: 2,
    itemHeightEstimate: 320,
    itemKey: (item) => item.id,
    render: renderMasonryCell,
    onRender: (startIndex, stopIndex = startIndex) => {
      void maybeLoadMore(startIndex, stopIndex, items);
    },
    role: 'grid',
    tabIndex: -1,
    itemStyle: {
      willChange: 'transform',
    },
  });

  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    if (element.scrollTop > 0) {
      setHasUserScrolled(true);
    }

    if (!isViewportReady) {
      setHasOverflowingContent(false);
      return;
    }

    setHasOverflowingContent(hasGalleryOverflow(element.scrollHeight, element.clientHeight));
  }, [isViewportReady, items.length, viewport.height, viewport.scrollTop, viewport.width]);

  const showEndOfGallery = isViewportReady && shouldShowGalleryEndIndicator({
    hasMoreGallery: hasMore,
    itemsLength: items.length,
    hasOverflowingContent,
    hasUserScrolled,
  });

  return (
    <div
      ref={scrollContainerRef}
      data-testid="gallery-scroll-container"
      data-gallery-viewport-ready={isViewportReady ? 'true' : 'false'}
      className="custom-scrollbar flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
    >
      {isInitialLoading ? (
        <GallerySkeletonGrid columnsCount={columnsCount} />
      ) : items.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
          No gallery items yet
        </div>
      ) : (
        masonry
      )}

      <div className="flex min-h-24 flex-col items-center justify-center gap-4 py-12">
        {isLoadingMore ? (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={24} className="text-white/20" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">Loading more...</span>
          </div>
        ) : hasMore ? (
          <div className="h-4" />
        ) : showEndOfGallery ? (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white to-transparent" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white">End of Gallery</span>
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
