"use client";

import { useEffect, useState, startTransition } from 'react';
import { ArrowUpDown, Calendar as CalendarIcon, ChevronDown, Search, SlidersHorizontal, User, X } from 'lucide-react';
import type { SortBy } from '@/lib/server/service/history.service';
import type {
  GalleryCustomDateRange,
  GalleryInnerTab,
  GalleryTimeFilter,
  GalleryTimePreset,
} from '@/lib/gallery/types';
import { GALLERY_TIME_PRESET_OPTIONS } from '@/lib/gallery/types';
import { Button } from '@/components/ui/button';
import { Calendar, type CalendarRangeValue, toDateKey } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SplitText from '@/components/ui/split-text';
import { cn } from '@/lib/utils';

const TOTAL_IMAGE_COUNT_FORMATTER = new Intl.NumberFormat('en-US');

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
  totalImageCount?: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortBy: Exclude<SortBy, 'interactionPriority'>;
  onSortByChange: (sortBy: Exclude<SortBy, 'interactionPriority'>) => void;
  isFilterOpen: boolean;
  onFilterToggle: () => void;
  hasActiveFilters: boolean;
  galleryScopeFilter: 'all' | 'featured';
  onGalleryScopeFilterChange: (value: 'all' | 'featured') => void;
  byMeOnly: boolean;
  onByMeOnlyChange: (value: boolean) => void;
  timeFilter: GalleryTimeFilter;
  onTimeFilterChange: (value: GalleryTimeFilter) => void;
  isAuthenticated: boolean;
  generatedImages?: number;
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

function formatRangeLabel(range: GalleryCustomDateRange): string {
  if (range.from && range.to) {
    return `${range.from} ~ ${range.to}`;
  }
  if (range.from) {
    return `从 ${range.from}`;
  }
  if (range.to) {
    return `截至 ${range.to}`;
  }
  return '选择日期';
}

function describeTimeFilter(timeFilter: GalleryTimeFilter): string {
  if (timeFilter.kind === 'preset') {
    const option = GALLERY_TIME_PRESET_OPTIONS.find((entry) => entry.value === timeFilter.value);
    return option?.label ?? '';
  }
  return formatRangeLabel(timeFilter.range);
}

function isTimeFilterActive(timeFilter: GalleryTimeFilter): boolean {
  if (timeFilter.kind === 'preset') {
    return timeFilter.value !== 'all';
  }
  return Boolean(timeFilter.range.from || timeFilter.range.to);
}

function GalleryTimeFilterControl({
  timeFilter,
  onTimeFilterChange,
}: {
  timeFilter: GalleryTimeFilter;
  onTimeFilterChange: (value: GalleryTimeFilter) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<CalendarRangeValue>(() => {
    if (timeFilter.kind === 'custom') {
      return { from: timeFilter.range.from, to: timeFilter.range.to };
    }
    return {};
  });

  // 打开时把草稿同步成当前生效值；切换预设/自定义时也会自然回到一致状态
  useEffect(() => {
    if (calendarOpen) {
      if (timeFilter.kind === 'custom') {
        setDraftRange({ from: timeFilter.range.from, to: timeFilter.range.to });
      } else {
        setDraftRange({});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarOpen]);

  const active = isTimeFilterActive(timeFilter);
  const label = describeTimeFilter(timeFilter);
  const draftIsComplete = Boolean(draftRange.from && draftRange.to);
  const draftHasPartial = Boolean(
    (draftRange.from && !draftRange.to) || (!draftRange.from && draftRange.to),
  );

  const applyDraft = () => {
    if (!draftRange.from && !draftRange.to) {
      onTimeFilterChange({ kind: 'preset', value: 'all' });
    } else {
      onTimeFilterChange({
        kind: 'custom',
        range: { from: draftRange.from, to: draftRange.to },
      });
    }
    setCalendarOpen(false);
  };

  const clearDraft = () => {
    setDraftRange({});
    onTimeFilterChange({ kind: 'preset', value: 'all' });
    setCalendarOpen(false);
  };

  const todayKey = toDateKey(new Date());
  const quickRanges: Array<{ label: string; value: { from: string; to: string } }> = [
    { label: '今天', value: { from: todayKey, to: todayKey } },
    {
      label: '最近 7 天',
      value: {
        from: toDateKey(new Date(new Date().setDate(new Date().getDate() - 6))),
        to: todayKey,
      },
    },
    {
      label: '最近 30 天',
      value: {
        from: toDateKey(new Date(new Date().setDate(new Date().getDate() - 29))),
        to: todayKey,
      },
    },
  ];

  return (
    <div className="flex items-center gap-1">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-10 gap-2 border-white/10 bg-white/5 px-3 text-white/70 hover:bg-white/10 hover:text-white',
              active && 'border-white/20 bg-white/10 text-white',
            )}
            title="按任意日期范围筛选"
          >
            <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
            {/* <span className="text-sm">{label}</span> */}
            {/* <ChevronDown className="h-3 w-3 opacity-50" /> */}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-[320px] border-white/10 bg-black/90 backdrop-blur p-3 text-white"
        >
          <div className="flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wider text-white/40">快捷范围</div>
            <div className="grid grid-cols-3 gap-1.5">
              {quickRanges.map((entry) => (
                <button
                  key={`gallery-time-quick-${entry.label}`}
                  type="button"
                  onClick={() => {
                    setDraftRange(entry.value);
                    onTimeFilterChange({ kind: 'custom', range: entry.value });
                    setCalendarOpen(false);
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="text-xs uppercase tracking-wider text-white/40">自定义日期</div>
            <Calendar mode="range" value={draftRange} onChange={setDraftRange} />

            <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={clearDraft}
                className="rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                清除
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarOpen(false)}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={draftHasPartial}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs transition-colors',
                    draftHasPartial
                      ? 'cursor-not-allowed bg-white/5 text-white/30'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {draftIsComplete ? '应用范围' : draftRange.from || draftRange.to ? '应用单点' : '不筛选'}
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              'h-10 w-9 border-white/10 bg-white/5 px-0 text-white/70 hover:bg-white/10 hover:text-white',
              active && 'border-white/20 bg-white/10 text-white',
            )}
            title="快速预设时间窗口"
            aria-label="快速预设时间窗口"
          >
            <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 border-white/10 bg-black/90">
          {GALLERY_TIME_PRESET_OPTIONS.map((option) => {
            const isCurrentPreset = timeFilter.kind === 'preset' && timeFilter.value === option.value;
            return (
              <DropdownMenuItem
                key={`gallery-time-preset-${option.value}`}
                onClick={() => onTimeFilterChange({ kind: 'preset', value: option.value as GalleryTimePreset })}
                className={cn(
                  'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                  isCurrentPreset && 'bg-white/10 text-white',
                )}
              >
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu> */}
    </div>
  );
}

export function GalleryToolbar({
  activeTab,
  onActiveTabChange,
  totalImageCount,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  isFilterOpen,
  onFilterToggle,
  hasActiveFilters,
  galleryScopeFilter,
  onGalleryScopeFilterChange,
  byMeOnly,
  onByMeOnlyChange,
  timeFilter,
  onTimeFilterChange,
  isAuthenticated,
	generatedImages,
}: GalleryToolbarProps) {
  const currentSortOption = GALLERY_SORT_OPTIONS.find((option) => option.value === sortBy) || GALLERY_SORT_OPTIONS[0];
  const searchPlaceholder =
    activeTab === 'gallery' ? 'Search gallery prompts...' : 'Search prompt records...';
  const formattedTotalImageCount =
    typeof totalImageCount === 'number' ? TOTAL_IMAGE_COUNT_FORMATTER.format(totalImageCount) : null;

  return (
    <div
      className="mt-4 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-4"
      data-gallery-total-count={typeof totalImageCount === 'number' ? totalImageCount : undefined}
    >
      <div className="mb-0 flex min-w-0 flex-wrap items-center gap-5 font-serif">
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
        {formattedTotalImageCount ? (
          <div
            aria-label={`Total gallery images: ${formattedTotalImageCount}`}
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] px-3 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-white/55"
          >
            {formattedTotalImageCount} images
          </div>
        ) : null}

        {generatedImages !== undefined && (
          <span title="Cumulative generated images" className="text-xs font-sans text-white/40">
            {generatedImages.toLocaleString()} generated
          </span>
        )}

      </div>

      <div className="flex flex-wrap items-center gap-3">
        {activeTab === 'gallery' ? (
          <div className="flex h-10 items-center rounded-xl border-none bg-white/0 p-1">
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

        {activeTab === 'gallery' && isAuthenticated ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => startTransition(() => onByMeOnlyChange(!byMeOnly))}
            className={cn(
              'h-10 gap-2 border-white/10 bg-white/5 px-3 text-white/70 hover:bg-white/10 hover:text-white',
              byMeOnly && 'border-white/20 bg-white/10 text-white',
            )}
            title={byMeOnly ? '仅显示我生成的图片（点击取消）' : '只看我生成的图片'}
          >
            <User className="h-4 w-4" />
            <span className="text-sm">By Me</span>
            {byMeOnly ? <div className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          </Button>
        ) : null}

        <GalleryTimeFilterControl
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
        />

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
