"use client";

import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import { GalleryImageCard } from './GalleryImageCard';

interface GalleryStaticWallProps {
  items: GalleryItemViewModel[];
  actions: GalleryActionHandlers;
  moodboardData: GalleryMoodboardData;
  allItems?: import('@/types/database').Generation[];
}

export function GalleryStaticWall({
  items,
  actions,
  moodboardData,
  allItems,
}: GalleryStaticWallProps) {
  return (
    <div
      data-testid="gallery-scroll-container"
      data-gallery-viewport-ready="true"
      className="custom-scrollbar flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-scroll"
    >
      {items.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
          No gallery items yet
        </div>
      ) : (
        <div
          data-testid="gallery-static-wall"
          className="w-full"
          style={{
            columnWidth: '170px',
            columnGap: '1px',
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="mb-[1px] break-inside-avoid"
            >
              <GalleryImageCard
                item={item}
                actions={actions}
                moodboardData={moodboardData}
                allItems={allItems}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-24 min-w-0 w-full flex-col items-center justify-center gap-4 py-12">
        <div className="flex flex-col items-center gap-2 opacity-20">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white to-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white">End of Gallery</span>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white to-transparent" />
        </div>
      </div>
    </div>
  );
}
