"use client";

import React, {
  CSSProperties,
  ReactNode,
  RefObject,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Generation } from '@/types/database';

import {
  buildStableGalleryColumns,
  buildVirtualizedGalleryLayout,
  estimateGalleryCardHeight,
  getVisibleVirtualizedGalleryItems,
  sortGalleryItems,
  type StableGalleryColumnsState,
} from './gallery-layout';

interface VirtualizedGalleryMasonryProps<T extends Generation> {
  items: T[];
  columnsCount: number;
  containerWidth: number;
  layoutKey: string;
  scrollContainerRef: RefObject<HTMLDivElement>;
  gap?: number;
  overscan?: number;
  onLayoutStableChange?: (isStable: boolean) => void;
  renderItem: (item: T, orderedIndex: number, itemKey: string) => ReactNode;
}

interface MeasuredVirtualItemProps {
  itemKey: string;
  style: CSSProperties;
  onHeightChange: (itemKey: string, height: number) => void;
  children: ReactNode;
}

function MeasuredVirtualItem({ itemKey, style, onHeightChange, children }: MeasuredVirtualItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = itemRef.current;
    if (!element) return;

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) {
        onHeightChange(itemKey, height);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [itemKey, onHeightChange]);

  return (
    <div ref={itemRef} style={style} data-gallery-item-key={itemKey}>
      {children}
    </div>
  );
}

export function VirtualizedGalleryMasonry<T extends Generation>({
  items,
  columnsCount,
  containerWidth,
  layoutKey,
  scrollContainerRef,
  gap = 0,
  overscan = 800,
  onLayoutStableChange,
  renderItem,
}: VirtualizedGalleryMasonryProps<T>) {
  const safeColumnsCount = Math.max(columnsCount, 1);
  const measuredHeightsRef = useRef<Map<string, number>>(new Map());
  const stableColumnsStateRef = useRef<StableGalleryColumnsState | null>(null);
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  const orderedEntries = useMemo(() => sortGalleryItems(items), [items]);

  const stableColumns = useMemo(() => {
    const previousState = stableColumnsStateRef.current;
    if (
      !previousState ||
      previousState.layoutKey !== layoutKey ||
      previousState.columnsCount !== safeColumnsCount
    ) {
      measuredHeightsRef.current = new Map();
    }

    const nextColumns = buildStableGalleryColumns(
      orderedEntries,
      safeColumnsCount,
      layoutKey,
      previousState,
    );
    stableColumnsStateRef.current = nextColumns.state;
    return nextColumns;
  }, [layoutKey, orderedEntries, safeColumnsCount]);

  const columnWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    const totalGap = gap * (safeColumnsCount - 1);
    return Math.max(0, (containerWidth - totalGap) / safeColumnsCount);
  }, [containerWidth, gap, safeColumnsCount]);

  const layout = useMemo(() => {
    void measurementVersion;
    if (columnWidth <= 0) {
      return { containerHeight: 0, items: [] };
    }

    return buildVirtualizedGalleryLayout(
      stableColumns.columns,
      columnWidth,
      gap,
      measuredHeightsRef.current,
      estimateGalleryCardHeight,
    );
  }, [columnWidth, gap, measurementVersion, stableColumns.columns]);

  const visibleItems = useMemo(
    () => getVisibleVirtualizedGalleryItems(layout.items, viewport.scrollTop, viewport.height, overscan),
    [layout.items, overscan, viewport.height, viewport.scrollTop],
  );

  const handleHeightChange = useCallback((itemKey: string, height: number) => {
    const normalizedHeight = Math.round(height * 100) / 100;
    const currentHeight = measuredHeightsRef.current.get(itemKey);
    if (currentHeight !== undefined && Math.abs(currentHeight - normalizedHeight) < 0.5) {
      return;
    }

    measuredHeightsRef.current.set(itemKey, normalizedHeight);
    startTransition(() => {
      setMeasurementVersion((version) => version + 1);
    });
  }, []);

  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    let frameId = 0;
    const syncViewport = () => {
      frameId = 0;
      setViewport((currentViewport) => {
        const nextViewport = {
          scrollTop: element.scrollTop,
          height: element.clientHeight,
        };
        if (
          currentViewport.scrollTop === nextViewport.scrollTop &&
          currentViewport.height === nextViewport.height
        ) {
          return currentViewport;
        }
        return nextViewport;
      });
    };

    const scheduleViewportSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncViewport);
    };

    syncViewport();
    element.addEventListener('scroll', scheduleViewportSync, { passive: true });

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleViewportSync);
      return () => {
        element.removeEventListener('scroll', scheduleViewportSync);
        window.removeEventListener('resize', scheduleViewportSync);
        if (frameId !== 0) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const observer = new ResizeObserver(() => {
      scheduleViewportSync();
    });
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', scheduleViewportSync);
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    onLayoutStableChange?.(containerWidth > 0 && (items.length === 0 || layout.items.length > 0));
  }, [containerWidth, items.length, layout.items.length, onLayoutStableChange]);

  return (
    <div
      data-testid="virtualized-gallery-grid"
      className="relative w-full"
      style={{ height: `${Math.max(layout.containerHeight, 0)}px` }}
    >
      {visibleItems.map((entry) => (
        <MeasuredVirtualItem
          key={entry.key}
          itemKey={entry.key}
          onHeightChange={handleHeightChange}
          style={{
            position: 'absolute',
            width: `${entry.width}px`,
            transform: `translate3d(${entry.left}px, ${entry.top}px, 0)`,
          }}
        >
          {renderItem(entry.item, entry.orderedIndex, entry.key)}
        </MeasuredVirtualItem>
      ))}
    </div>
  );
}
