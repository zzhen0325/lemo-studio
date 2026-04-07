"use client";

import React, { useCallback, useEffect, useRef } from 'react';

import type { GenerateOptions } from '@studio/playground/_components/hooks/useGenerationService';
import type { Generation } from '@/types/database';

import { GalleryImageCard } from './GalleryImageCard';
import { VirtualizedGalleryMasonry } from './VirtualizedGalleryMasonry';
import { useGalleryContainerWidth } from './use-gallery-container-width';

interface GalleryImageWallProps {
  items: Generation[];
  layoutKey: string;
  isInitialLoading: boolean;
  isFetchingGallery: boolean;
  hasMoreGallery: boolean;
  onLoadMore: () => void;
  onLayoutStableChange?: (isStable: boolean) => void;
  onSelectItem?: (item: Generation, items?: Generation[]) => void;
  onDownload: (event: React.MouseEvent, url: string, filename: string) => void;
  onGenerate: (options?: GenerateOptions) => Promise<unknown>;
  onUsePrompt?: (item: Generation) => void;
  onUseImage?: (item: Generation) => void | Promise<void>;
  moodboards: import('@/types/database').StyleStack[];
  moodboardCards: import('@/config/moodboard-cards').MoodboardCard[];
  refreshMoodboardCards: () => Promise<void>;
}

const LOAD_MORE_THRESHOLD = 1600;

export function GalleryImageWall({
  items,
  layoutKey,
  isInitialLoading,
  isFetchingGallery,
  hasMoreGallery,
  onLoadMore,
  onLayoutStableChange,
  onSelectItem,
  onDownload,
  onGenerate,
  onUsePrompt,
  onUseImage,
  moodboards,
  moodboardCards,
  refreshMoodboardCards,
}: GalleryImageWallProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, columnsCount } = useGalleryContainerWidth(scrollContainerRef);

  const checkShouldLoadMore = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element || isFetchingGallery || !hasMoreGallery) return;

    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= LOAD_MORE_THRESHOLD) {
      onLoadMore();
    }
  }, [hasMoreGallery, isFetchingGallery, onLoadMore]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    let frameId = 0;
    const scheduleCheck = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        checkShouldLoadMore();
      });
    };

    scheduleCheck();
    element.addEventListener('scroll', scheduleCheck, { passive: true });

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleCheck);
      return () => {
        element.removeEventListener('scroll', scheduleCheck);
        window.removeEventListener('resize', scheduleCheck);
        if (frameId !== 0) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const observer = new ResizeObserver(() => {
      scheduleCheck();
    });
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', scheduleCheck);
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [checkShouldLoadMore]);

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col w-full min-h-0 overflow-y-auto">
      {isInitialLoading ? (
        <GallerySkeletonGrid columnsCount={columnsCount} />
      ) : (
        <VirtualizedGalleryMasonry
          items={items}
          columnsCount={columnsCount}
          containerWidth={containerWidth}
          layoutKey={layoutKey}
          scrollContainerRef={scrollContainerRef}
          onLayoutStableChange={onLayoutStableChange}
          renderItem={(item, orderedIndex, itemKey) => (
            <GalleryImageCard
              key={itemKey}
              item={item}
              imageLoadKey={`${itemKey}:${item.outputUrl || ''}`}
              onSelectItem={onSelectItem}
              onDownload={onDownload}
              onGenerate={onGenerate}
              onUsePrompt={onUsePrompt}
              onUseImage={onUseImage}
              moodboards={moodboards}
              moodboardCards={moodboardCards}
              refreshMoodboardCards={refreshMoodboardCards}
            />
          )}
        />
      )}

      <div className="py-12 flex flex-col items-center justify-center gap-4">
        {isFetchingGallery && !isInitialLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Thinking...</span>
          </div>
        ) : hasMoreGallery ? (
          <div className="h-4" />
        ) : items.length > 0 ? (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
            <span className="text-[10px] text-white font-mono uppercase tracking-widest">
              End of Gallery
            </span>
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GallerySkeletonGrid({ columnsCount }: { columnsCount: number }) {
  const cols = Math.max(columnsCount, 1);

  return (
    <div data-testid="gallery-skeleton-grid" className="flex gap-3 w-full">
      {Array.from({ length: cols }).map((_, colIdx) => (
        <div key={`gallery-skeleton-col-${colIdx}`} className="flex flex-col gap-3 flex-1 min-w-0">
          {Array.from({ length: 3 }).map((__, itemIdx) => (
            <div
              key={`gallery-skeleton-item-${colIdx}-${itemIdx}`}
              className="w-full rounded-xl bg-white/5 border border-white/10 animate-pulse"
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
