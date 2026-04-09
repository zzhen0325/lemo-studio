"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { useInfiniteLoader, useMasonry, usePositioner, useResizeObserver } from 'masonic';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  hasGalleryOverflow,
  isGalleryViewportReady,
  shouldShowGalleryEndIndicator,
} from '@/lib/gallery/scroll-helpers';
import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import { GalleryImageCard } from './GalleryImageCard';

const GALLERY_COLUMN_WIDTH = 170;
const GALLERY_COLUMN_GUTTER = 1;
const GALLERY_MAX_COLUMN_COUNT = 8;

function getGalleryColumnsCount(containerWidth: number) {
  return Math.min(
    Math.floor((containerWidth + GALLERY_COLUMN_GUTTER) / (GALLERY_COLUMN_WIDTH + GALLERY_COLUMN_GUTTER)),
    GALLERY_MAX_COLUMN_COUNT,
  ) || 1;
}

function useElementHeight<T extends HTMLElement>(elementRef: RefObject<T | null>) {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;
    const updateHeight = () => {
      frameId = 0;
      setHeight((current) => {
        const nextHeight = element.clientHeight;
        return current === nextHeight ? current : nextHeight;
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(updateHeight);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [elementRef]);

  return height;
}

function useElementWidth<T extends HTMLElement>(elementRef: RefObject<T | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;
    const updateWidth = () => {
      frameId = 0;
      setWidth((current) => {
        const nextWidth = element.clientWidth;
        return current === nextWidth ? current : nextWidth;
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(updateWidth);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [elementRef]);

  return width;
}

function useWindowWidth() {
  const [windowWidth, setWindowWidth] = useState(() => (
    typeof window === 'undefined' ? 0 : window.innerWidth
  ));

  useLayoutEffect(() => {
    const updateWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth, { passive: true });

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  return windowWidth;
}

function useScrollViewport(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  const height = useElementHeight(scrollContainerRef);
  const [scrollState, setScrollState] = useState({
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
    const syncScrollTop = () => {
      frameId = 0;
      setScrollState((current) => {
        const next = {
          scrollTop: element.scrollTop,
          isScrolling: current.isScrolling,
        };

        if (current.scrollTop === next.scrollTop && current.isScrolling === next.isScrolling) {
          return current;
        }

        return next;
      });
    };

    const scheduleSync = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(syncScrollTop);
    };

    const handleScroll = () => {
      setScrollState((current) => {
        if (current.scrollTop === element.scrollTop && current.isScrolling) {
          return current;
        }

        return {
          scrollTop: element.scrollTop,
          isScrolling: true,
        };
      });

      if (scrollingTimeoutRef.current !== null) {
        window.clearTimeout(scrollingTimeoutRef.current);
      }

      scrollingTimeoutRef.current = window.setTimeout(() => {
        setScrollState((current) => current.isScrolling ? { ...current, isScrolling: false } : current);
      }, 120);

      scheduleSync();
    };

    scheduleSync();
    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      if (scrollingTimeoutRef.current !== null) {
        window.clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, [scrollContainerRef]);

  return {
    height,
    ...scrollState,
  };
}

function resolveGridWidth(
  masonryContainerRef: MutableRefObject<HTMLDivElement | null>,
  measuredWidth: number,
  fallbackWidth: number,
) {
  if (measuredWidth > 0) {
    return measuredWidth;
  }

  const offsetWidth = masonryContainerRef.current?.offsetWidth ?? 0;
  if (offsetWidth > 0) {
    return offsetWidth;
  }

  return fallbackWidth;
}

function GallerySkeletonGrid({ columnsCount }: { columnsCount: number }) {
  const cols = Math.max(columnsCount, 1);

  return (
    <div data-testid="gallery-skeleton-grid" className="flex min-w-0 w-full gap-[1px]">
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

function GalleryMasonryWallFallback({
  itemsLength,
  isInitialLoading,
}: {
  itemsLength: number;
  isInitialLoading: boolean;
}) {
  return (
    <div
      data-testid="gallery-scroll-container"
      data-gallery-viewport-ready="false"
      className="custom-scrollbar flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-scroll"
    >
      <div
        data-testid="gallery-masonry-container"
        className="flex min-h-0 min-w-0 w-full flex-none flex-col"
      >
        {isInitialLoading || itemsLength > 0 ? (
          <GallerySkeletonGrid columnsCount={4} />
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
            No gallery items yet
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryMasonryWallClient({
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
  const masonryContainerRef = useRef<HTMLDivElement>(null);
  const masonryGridRef = useRef<HTMLElement | null>(null);
  const windowWidth = useWindowWidth();
  const viewport = useScrollViewport(scrollContainerRef);
  const masonryContainerWidth = useElementWidth(masonryContainerRef);
  const measuredGridWidth = resolveGridWidth(masonryContainerRef, masonryContainerWidth, 0);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [hasOverflowingContent, setHasOverflowingContent] = useState(false);
  const [stableGridWidth, setStableGridWidth] = useState(0);

  useLayoutEffect(() => {
    if (measuredGridWidth <= 0) {
      return;
    }

    setStableGridWidth((current) => current === measuredGridWidth ? current : measuredGridWidth);
  }, [measuredGridWidth]);

  const gridWidth = measuredGridWidth || stableGridWidth || windowWidth;
  const columnsCount = getGalleryColumnsCount(gridWidth);
  const isViewportReady = isGalleryViewportReady({
    clientHeight: viewport.height,
    containerWidth: gridWidth,
    windowHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
  });
  const isMasonryReady = isViewportReady && gridWidth > 0;

  const positioner = usePositioner(
    {
      width: Math.max(gridWidth, 1),
      columnWidth: GALLERY_COLUMN_WIDTH,
      columnGutter: GALLERY_COLUMN_GUTTER,
      rowGutter: GALLERY_COLUMN_GUTTER,
      maxColumnCount: GALLERY_MAX_COLUMN_COUNT,
    },
    [layoutKey],
  );
  const resizeObserver = useResizeObserver(positioner);
  const inflightLoadMoreRef = useRef(false);

  const maybeLoadMore = useInfiniteLoader(
    useCallback(async () => {
      if (!isMasonryReady || !hasMore || isLoadingMore || inflightLoadMoreRef.current) {
        return;
      }

      inflightLoadMoreRef.current = true;
      try {
        await onLoadMore();
      } finally {
        inflightLoadMoreRef.current = false;
      }
    }, [hasMore, isLoadingMore, isMasonryReady, onLoadMore]),
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
        renderMode="virtualized"
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
    className: 'min-w-0 w-full',
    containerRef: masonryGridRef,
  });

  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    if (element.scrollTop > 0) {
      setHasUserScrolled(true);
    }

    if (!isMasonryReady) {
      setHasOverflowingContent(false);
      return;
    }

    setHasOverflowingContent(hasGalleryOverflow(element.scrollHeight, element.clientHeight));
  }, [isMasonryReady, items.length, viewport.height, viewport.scrollTop, gridWidth]);

  const showEndOfGallery = isMasonryReady && shouldShowGalleryEndIndicator({
    hasMoreGallery: hasMore,
    itemsLength: items.length,
    hasOverflowingContent,
    hasUserScrolled,
  });

  return (
    <div
      ref={scrollContainerRef}
      data-testid="gallery-scroll-container"
      data-gallery-viewport-ready={isMasonryReady ? 'true' : 'false'}
      className="custom-scrollbar flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-scroll"
    >
      <div
        ref={masonryContainerRef}
        data-testid="gallery-masonry-container"
        className="flex min-h-0 min-w-0 w-full flex-none flex-col"
      >
        {isInitialLoading || !isMasonryReady ? (
          <GallerySkeletonGrid columnsCount={columnsCount} />
        ) : items.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
            No gallery items yet
          </div>
        ) : (
          <div
            data-testid="gallery-masonry-grid-shell"
            className="min-h-0 min-w-0 w-full"
          >
            {masonry}
          </div>
        )}
      </div>

      <div className="flex min-h-24 min-w-0 w-full flex-col items-center justify-center gap-4 py-12">
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

export function GalleryMasonryWall(props: GalleryMasonryWallProps) {
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  if (!isClientReady || typeof ResizeObserver === 'undefined') {
    return (
      <GalleryMasonryWallFallback
        itemsLength={props.items.length}
        isInitialLoading={props.isInitialLoading}
      />
    );
  }

  return <GalleryMasonryWallClient {...props} />;
}
