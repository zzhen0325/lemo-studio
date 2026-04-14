"use client";

import { startTransition } from 'react';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { SortBy } from '@/lib/server/service/history.service';
import type { GalleryInnerTab } from '@/lib/gallery/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SplitText from '@/components/ui/split-text';
import { cn } from '@/lib/utils';

export const GALLERY_SORT_OPTIONS: Array<{
  value: Exclude<SortBy, 'interactionPriority'>;
  label: string;
}> = [
  { value: 'recent', label: '最新' },
  { value: 'likes', label: '点赞最多' },
  { value: 'favorites', label: '收藏最多' },
  { value: 'downloads', label: '下载最多' },
  { value: 'edits', label: '编辑最多' },
];

interface GalleryToolbarProps {
  activeTab: GalleryInnerTab;
  onActiveTabChange: (tab: GalleryInnerTab) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortBy: Exclude<SortBy, 'interactionPriority'>;
  onSortByChange: (sortBy: Exclude<SortBy, 'interactionPriority'>) => void;
  isFilterOpen: boolean;
  onFilterToggle: () => void;
  hasActiveFilters: boolean;
  galleryScopeFilter: 'all' | 'featured';
  onGalleryScopeFilterChange: (value: 'all' | 'featured') => void;
}

function GalleryHeaderTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('transition-opacity duration-200', isActive ? 'opacity-100' : 'opacity-35 hover:opacity-70')}
    >
      <SplitText
        text={label}
        tag="span"
        textAlign="left"
        className="flex items-center text-3xl font-serif text-white"
        from={{ opacity: 1, y: 0 }}
        to={{ opacity: 1, y: 0 }}
        hoverFrom={{ opacity: 0.45, y: 10 }}
        hoverTo={{ opacity: 1, y: 0 }}
        duration={0.28}
        delay={12}
        threshold={0}
        rootMargin="0px"
      />
    </button>
  );
}

export function GalleryToolbar({
  activeTab,
  onActiveTabChange,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  isFilterOpen,
  onFilterToggle,
  hasActiveFilters,
  galleryScopeFilter,
  onGalleryScopeFilterChange,
}: GalleryToolbarProps) {
  const currentSortOption = GALLERY_SORT_OPTIONS.find((option) => option.value === sortBy) || GALLERY_SORT_OPTIONS[0];
  const searchPlaceholder =
    activeTab === 'gallery' ? 'Search gallery prompts...' : 'Search prompt records...';

  return (
    <div className="mt-4 flex h-14 shrink-0 flex-row items-center justify-between gap-4">
      <div className="mb-0 flex items-center gap-5 font-serif">
        <GalleryHeaderTab
          label="Gallery"
          isActive={activeTab === 'gallery'}
          onClick={() => onActiveTabChange('gallery')}
        />
        <GalleryHeaderTab
          label="Prompt"
          isActive={activeTab === 'prompt'}
          onClick={() => onActiveTabChange('prompt')}
        />
      </div>

      <div className="flex items-center gap-3">
        {activeTab === 'gallery' ? (
          <div className="flex h-10 items-center rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => startTransition(() => onGalleryScopeFilterChange('all'))}
              className={cn(
                'flex h-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
                galleryScopeFilter === 'all'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              所有
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => onGalleryScopeFilterChange('featured'))}
              className={cn(
                'flex h-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
                galleryScopeFilter === 'featured'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              精选
            </button>
          </div>
        ) : null}

        <div className="group relative flex w-80 items-center">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white group-focus-within:text-white/60" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => {
              const value = event.target.value;
              startTransition(() => onSearchQueryChange(value));
            }}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:bg-black/80 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-3 top-1/2 rounded-full p-1 text-white/30 transition-all hover:bg-white/10 hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <span className="text-sm">{currentSortOption.label}</span>
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 border-white/10 bg-black/90">
            {GALLERY_SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortByChange(option.value)}
                className={cn(
                  'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                  sortBy === option.value && 'bg-white/10 text-white',
                )}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          onClick={onFilterToggle}
          className={cn(
            'h-10 gap-2 border-white/10 bg-white/5 px-3 text-white/70 hover:bg-white/10 hover:text-white',
            isFilterOpen && 'border-white/20 bg-white/10 text-white',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-sm">Filters</span>
          {hasActiveFilters ? <div className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </Button>
      </div>
    </div>
  );
}
