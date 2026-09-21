"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  getGalleryPromptCategory,
  type GalleryPromptCategory,
} from '@/app/studio/playground/_lib/prompt-history';
import type {
  GalleryFilterState,
  GalleryInnerTab,
  GallerySceneProps,
  GalleryTimeFilter,
} from '@/lib/gallery/types';
import { DEFAULT_GALLERY_TIME_FILTER } from '@/lib/gallery/types';
import { filterGalleryItems, isGalleryItemFeatured } from '@/lib/gallery/resolve-gallery-item';
import { useAuthStore } from '@/lib/store/auth-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GalleryFilterPanel } from './GalleryFilterPanel';
import { GalleryMasonryWall } from './GalleryMasonryWall';
import dynamic from 'next/dynamic';
import { GalleryStaticWall } from './GalleryStaticWall';
import { GalleryToolbar } from './GalleryToolbar';

const GalleryPromptGrid = dynamic(() => import('./GalleryPromptGrid').then((module) => module.GalleryPromptGrid), { ssr: false });

function isTimeFilterActive(timeFilter: GalleryTimeFilter): boolean {
  if (timeFilter.kind === 'preset') {
    return timeFilter.value !== 'all';
  }
  return Boolean(timeFilter.range.from || timeFilter.range.to);
}

export function GalleryScene({
  feed,
  isActive,
  actions,
  moodboardData,
  sortBy,
  onSortByChange,
  byMeOnly: controlledByMeOnly,
  onByMeOnlyChange,
}: GallerySceneProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const actorId = useAuthStore((state) => state.actorId);
  const isAuthenticated = Boolean(actorId);
  const useStaticLocalFixtureWall =
    pathname === '/studio/gallery/local' && searchParams.get('wall') !== 'masonry';
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [selectedPromptCategories, setSelectedPromptCategories] = useState<GalleryPromptCategory[]>([]);
  const [activeInnerTab, setActiveInnerTab] = useState<GalleryInnerTab>('gallery');
  const [galleryScopeFilter, setGalleryScopeFilter] = useState<'all' | 'featured'>('all');
  const [internalByMeOnly, setInternalByMeOnly] = useState<boolean>(false);
  const [timeFilter, setTimeFilter] = useState<GalleryTimeFilter>(DEFAULT_GALLERY_TIME_FILTER);
  const [isGalleryFilterOpen, setIsGalleryFilterOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<number>();

  const byMeOnly = controlledByMeOnly ?? internalByMeOnly;
  const setByMeOnly = (next: boolean | ((current: boolean) => boolean)) => {
    if (onByMeOnlyChange) {
      onByMeOnlyChange(typeof next === 'function' ? (next as (current: boolean) => boolean)(byMeOnly) : next);
      return;
    }
    setInternalByMeOnly((current) => (typeof next === 'function' ? (next as (current: boolean) => boolean)(current) : next));
  };

  const filters = useMemo<GalleryFilterState>(() => ({
    searchQuery: deferredSearchQuery,
    selectedModels,
    selectedPresets,
    selectedPromptCategories,
    byMeOnly,
    timeFilter,
  }), [byMeOnly, deferredSearchQuery, selectedModels, selectedPresets, selectedPromptCategories, timeFilter]);

  const filterContext = useMemo(() => ({ currentUserId: actorId }), [actorId]);

  const filteredGalleryItems = useMemo(() => {
    const baseItems = filterGalleryItems(feed.items, filters, filterContext);
    if (galleryScopeFilter === 'featured') {
      return baseItems.filter((item) => isGalleryItemFeatured(item.raw));
    }
    return baseItems;
  }, [feed.items, filters, filterContext, galleryScopeFilter]);
  const filteredPromptItems = useMemo(
    () => filterGalleryItems(feed.promptItems, filters, filterContext),
    [feed.promptItems, filters, filterContext],
  );

  const availablePromptCategories = useMemo(() => {
    const sourceItems = activeInnerTab === 'prompt' ? filteredPromptItems : filteredGalleryItems;
    return Array.from(
      new Set(sourceItems.map((item) => getGalleryPromptCategory(item.raw.config))),
    );
  }, [activeInnerTab, filteredGalleryItems, filteredPromptItems]);

  const hasActiveFilters =
    selectedModels.length > 0
    || selectedPresets.length > 0
    || selectedPromptCategories.length > 0
    || byMeOnly
    || isTimeFilterActive(timeFilter);
  const galleryLayoutKey = `${activeInnerTab}|${deferredSearchQuery.trim().toLowerCase()}|${selectedModels.join(',')}|${selectedPresets.join(',')}|${selectedPromptCategories.join(',')}|${byMeOnly ? '1' : '0'}|${timeFilter.kind === 'preset' ? `p:${timeFilter.value}` : `c:${timeFilter.range.from ?? ''}_${timeFilter.range.to ?? ''}`}|${sortBy}|${galleryScopeFilter}`;

  // SWR already loads the first page. Refresh only when returning to the image wall,
  // rather than refetching after every initial response or appended page.
  const imageWallIsActive = isActive && activeInnerTab === 'gallery';
  const wasImageWallActive = useRef(imageWallIsActive);
  const revalidateLatest = feed.revalidateLatest;
  useEffect(() => {
    const isReturning = imageWallIsActive && !wasImageWallActive.current;
    wasImageWallActive.current = imageWallIsActive;
    if (isReturning) {
      void revalidateLatest();
    }
  }, [revalidateLatest, imageWallIsActive]);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setGeneratedImages(data.generatedImages))
      .catch(() => {});
  }, []);

  return (
    <TooltipProvider delayDuration={100}>
      <div
        data-testid="gallery-view-root"
        className="mx-auto flex min-h-0 min-w-0 w-full max-w-[95%] flex-1 flex-col overflow-hidden bg-transparent pt-10"
      >
        <div data-testid="gallery-view-shell" className="relative flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
            <div data-testid="gallery-view-stack" className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4 overflow-hidden">
              <GalleryToolbar
                activeTab={activeInnerTab}
                onActiveTabChange={setActiveInnerTab}
                totalImageCount={feed.total}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                sortBy={sortBy}
                onSortByChange={(nextSortBy) => startTransition(() => onSortByChange(nextSortBy))}
                isFilterOpen={isGalleryFilterOpen}
                onFilterToggle={() => setIsGalleryFilterOpen((current) => !current)}
                hasActiveFilters={hasActiveFilters}
                galleryScopeFilter={galleryScopeFilter}
                onGalleryScopeFilterChange={setGalleryScopeFilter}
                byMeOnly={byMeOnly}
                onByMeOnlyChange={(next) => startTransition(() => setByMeOnly(next))}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
                isAuthenticated={isAuthenticated}
                generatedImages={generatedImages}
              />

              <div data-testid="gallery-view-body" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-xl">
                {activeInnerTab === 'gallery' ? (
                  useStaticLocalFixtureWall ? (
                    <GalleryStaticWall
                      items={filteredGalleryItems}
                      actions={actions}
                      moodboardData={moodboardData}
                      allItems={filteredGalleryItems.map((item) => item.raw)}
                    />
                  ) : (
                    <GalleryMasonryWall
                      items={filteredGalleryItems}
                      layoutKey={galleryLayoutKey}
                      isActive={isActive && activeInnerTab === 'gallery'}
                      isInitialLoading={feed.isInitialLoading}
                      isLoadingMore={feed.isLoadingMore}
                      hasMore={feed.hasMore}
                      onLoadMore={feed.loadMore}
                      actions={actions}
                      moodboardData={moodboardData}
                      allItems={filteredGalleryItems.map((item) => item.raw)}
                      galleryScopeFilter={galleryScopeFilter}
                    />
                  )
                ) : (
                  <GalleryPromptGrid items={filteredPromptItems} actions={actions} />
                )}
              </div>
            </div>
          </div>

          <GalleryFilterPanel
            open={isGalleryFilterOpen}
            onClose={() => setIsGalleryFilterOpen(false)}
            availableModels={feed.filterOptions.models}
            availablePresets={feed.filterOptions.presets}
            availablePromptCategories={availablePromptCategories}
            selectedModels={selectedModels}
            selectedPresets={selectedPresets}
            selectedPromptCategories={selectedPromptCategories}
            onToggleModel={(model) => {
              startTransition(() => {
                setSelectedModels((current) =>
                  current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
                );
              });
            }}
            onTogglePreset={(preset) => {
              startTransition(() => {
                setSelectedPresets((current) =>
                  current.includes(preset) ? current.filter((item) => item !== preset) : [...current, preset],
                );
              });
            }}
            onTogglePromptCategory={(category) => {
              startTransition(() => {
                setSelectedPromptCategories((current) =>
                  current.includes(category)
                    ? current.filter((item) => item !== category)
                    : [...current, category],
                );
              });
            }}
            onClearFilters={() => {
              startTransition(() => {
                setSelectedModels([]);
                setSelectedPresets([]);
                setSelectedPromptCategories([]);
                setByMeOnly(false);
                setTimeFilter(DEFAULT_GALLERY_TIME_FILTER);
              });
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
