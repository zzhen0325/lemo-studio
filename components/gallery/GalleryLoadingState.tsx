"use client";

export function GallerySkeletonGrid({ columnsCount }: { columnsCount: number }) {
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

export function GalleryMasonryLoadingState({ columnsCount = 4 }: { columnsCount?: number }) {
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
        <GallerySkeletonGrid columnsCount={columnsCount} />
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
              <GalleryMasonryLoadingState />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
