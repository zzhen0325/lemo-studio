"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  getGalleryPromptCategory,
  type GalleryPromptCategory,
} from '@/app/studio/playground/_lib/prompt-history';
import type { GalleryFilterState, GalleryInnerTab, GallerySceneProps } from '@/lib/gallery/types';
import { filterGalleryItems, isGalleryItemDownloaded } from '@/lib/gallery/resolve-gallery-item';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GalleryFilterPanel } from './GalleryFilterPanel';
import { GalleryMasonryWall } from './GalleryMasonryWall';
import { GalleryPromptGrid } from './GalleryPromptGrid';
import { GalleryStaticWall } from './GalleryStaticWall';
import { GalleryToolbar } from './GalleryToolbar';

export function GalleryScene({
  feed,
  isActive,
  actions,
  moodboardData,
  sortBy,
  onSortByChange,
}: GallerySceneProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const useStaticLocalFixtureWall =
    pathname === '/studio/gallery/local' && searchParams.get('wall') !== 'masonry';
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [selectedPromptCategories, setSelectedPromptCategories] = useState<GalleryPromptCategory[]>([]);
  const [activeInnerTab, setActiveInnerTab] = useState<GalleryInnerTab>('gallery');
  const [galleryScopeFilter, setGalleryScopeFilter] = useState<'all' | 'featured'>('all');
  const [isGalleryFilterOpen, setIsGalleryFilterOpen] = useState(false);

  const filters = useMemo<GalleryFilterState>(() => ({
    searchQuery: deferredSearchQuery,
    selectedModels,
    selectedPresets,
    selectedPromptCategories,
  }), [deferredSearchQuery, selectedModels, selectedPresets, selectedPromptCategories]);

  const filteredGalleryItems = useMemo(() => {
    const baseItems = filterGalleryItems(feed.items, filters);
    if (galleryScopeFilter === 'featured') {
      return baseItems.filter((item) => isGalleryItemDownloaded(item.raw));
    }
    return baseItems;
  }, [feed.items, filters, galleryScopeFilter]);
  const filteredPromptItems = useMemo(
    () => filterGalleryItems(feed.promptItems, filters),
    [feed.promptItems, filters],
  );

  const availablePromptCategories = useMemo(() => {
    const sourceItems = activeInnerTab === 'prompt' ? filteredPromptItems : filteredGalleryItems;
    return Array.from(
      new Set(sourceItems.map((item) => getGalleryPromptCategory(item.raw.config))),
    );
  }, [activeInnerTab, filteredGalleryItems, filteredPromptItems]);

  const hasActiveFilters =
    selectedModels.length > 0 || selectedPresets.length > 0 || selectedPromptCategories.length > 0;
  const galleryLayoutKey = `${activeInnerTab}|${deferredSearchQuery.trim().toLowerCase()}|${selectedModels.join(',')}|${selectedPresets.join(',')}|${selectedPromptCategories.join(',')}|${sortBy}|${galleryScopeFilter}`;

  useEffect(() => {
    if (!isActive || activeInnerTab !== 'gallery' || feed.items.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void feed.revalidateLatest();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeInnerTab, feed.items.length, feed.revalidateLatest, isActive]);

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
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                sortBy={sortBy}
                onSortByChange={(nextSortBy) => startTransition(() => onSortByChange(nextSortBy))}
                isFilterOpen={isGalleryFilterOpen}
                onFilterToggle={() => setIsGalleryFilterOpen((current) => !current)}
                hasActiveFilters={hasActiveFilters}
                galleryScopeFilter={galleryScopeFilter}
                onGalleryScopeFilterChange={setGalleryScopeFilter}
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
              });
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
