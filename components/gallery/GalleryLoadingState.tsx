"use client";

import { cn } from "@/lib/utils";

const GALLERY_COLUMN_GUTTER_PX = 1;
const GALLERY_COLUMN_WIDTH = 170;
const GALLERY_MAX_COLUMN_COUNT = 8;

/**
 * Realistic placeholder aspect ratios. The distribution matches the
 * mixed image dimensions observed in the gallery (mostly 1:1 with
 * occasional landscape/portrait frames). Using a deterministic but
 * varied pattern keeps the skeleton visually consistent with how
 * `masonic` arranges real items, so the swap from skeleton to real
 * cards no longer causes a column-height "jump".
 */
const GALLERY_SKELETON_ASPECT_RATIOS: readonly { width: number; height: number }[] = [
  { width: 1, height: 1 },
  { width: 1, height: 1 },
  { width: 4, height: 3 },
  { width: 3, height: 4 },
  { width: 1, height: 1 },
  { width: 16, height: 9 },
  { width: 1, height: 1 },
  { width: 3, height: 4 },
  { width: 4, height: 3 },
  { width: 1, height: 1 },
  { width: 1, height: 1 },
  { width: 2, height: 3 },
];

function getSkeletonColumnsCount(containerWidth: number, fallbackWidth?: number) {
  const effectiveWidth = containerWidth > 0
    ? containerWidth
    : (fallbackWidth && fallbackWidth > 0 ? fallbackWidth : 0);

  if (effectiveWidth <= 0) {
    return 0;
  }

  return Math.min(
    Math.floor((effectiveWidth + GALLERY_COLUMN_GUTTER_PX) / (GALLERY_COLUMN_WIDTH + GALLERY_COLUMN_GUTTER_PX)),
    GALLERY_MAX_COLUMN_COUNT,
  ) || 1;
}

/**
 * Mirror the masonic positioner formula so the skeleton's column widths
 * match the real layout pixel-perfect (masonic floors the column width
 * with `Math.floor`, which `flex-1` cannot reproduce on its own).
 */
function getSkeletonColumnWidth(containerWidth: number, columnsCount: number) {
  if (containerWidth <= 0 || columnsCount <= 0) {
    return 0;
  }
  return Math.floor(
    (containerWidth - GALLERY_COLUMN_GUTTER_PX * (columnsCount - 1)) / columnsCount,
  );
}

export interface GallerySkeletonGridProps {
  columnsCount: number;
  className?: string;
  itemsPerColumn?: number;
  containerWidth?: number;
}

export function GallerySkeletonGrid({
  columnsCount,
  className,
  itemsPerColumn = 4,
  containerWidth = 0,
}: GallerySkeletonGridProps) {
  const cols = Math.max(columnsCount, 1);
  // Cap items to avoid producing an arbitrarily tall skeleton when the
  // column count is large; masonic also only renders a small initial
  // batch on first paint.
  const visibleItemsPerColumn = Math.max(1, Math.min(itemsPerColumn, 6));
  const columnWidthPx = getSkeletonColumnWidth(containerWidth, cols);

  return (
    <div
      data-testid="gallery-skeleton-grid"
      data-gallery-skeleton-columns={cols}
      className={cn(
        "flex min-w-0 w-full",
        className,
      )}
      style={{ gap: `${GALLERY_COLUMN_GUTTER_PX}px` }}
    >
      {Array.from({ length: cols }).map((_, colIdx) => (
        <div
          key={`gallery-skeleton-col-${colIdx}`}
          className="flex min-w-0 flex-col"
          style={{
            flex: columnWidthPx > 0 ? `0 0 ${columnWidthPx}px` : '1 1 0%',
            gap: `${GALLERY_COLUMN_GUTTER_PX}px`,
          }}
        >
          {Array.from({ length: visibleItemsPerColumn }).map((__, itemIdx) => {
            const aspect = GALLERY_SKELETON_ASPECT_RATIOS[
              (colIdx * visibleItemsPerColumn + itemIdx) % GALLERY_SKELETON_ASPECT_RATIOS.length
            ];
            const paddingPercent = (aspect.height / aspect.width) * 100;
            return (
              <div
                key={`gallery-skeleton-item-${colIdx}-${itemIdx}`}
                className="animate-pulse rounded-xl border border-white/10 bg-white/5"
                style={{ paddingBottom: `${paddingPercent}%` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export interface GalleryMasonryLoadingStateProps {
  columnsCount?: number;
  containerWidth?: number;
  fallbackWindowWidth?: number;
}

export function GalleryMasonryLoadingState({
  columnsCount,
  containerWidth = 0,
  fallbackWindowWidth,
}: GalleryMasonryLoadingStateProps) {
  const resolvedColumns = typeof columnsCount === 'number' && columnsCount > 0
    ? columnsCount
    : getSkeletonColumnsCount(containerWidth, fallbackWindowWidth);

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
        <GallerySkeletonGrid
          columnsCount={resolvedColumns}
          containerWidth={containerWidth}
        />
      </div>
    </div>
  );
}

export function GalleryViewLoadingShell() {
  return (
    <div
      data-testid="gallery-view-loading-shell"
      className="mx-auto flex min-h-0 min-w-0 w-full max-w-[95%] flex-1 flex-col overflow-hidden bg-transparent pt-10"
    >
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4 overflow-hidden">
            <div className="mt-4 flex h-14 shrink-0 flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="h-9 w-24 animate-pulse rounded-full bg-white/5" />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-80 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                <div className="h-10 w-28 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                <div className="h-10 w-28 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-xl">
              <GalleryMasonryLoadingState fallbackWindowWidth={1440} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
