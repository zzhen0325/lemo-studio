"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  Box,
  LucideIcon,
  Search,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from 'lucide-react';

import { GalleryImageWall } from '@studio/playground/_components/gallery/GalleryImageWall';
import { useGenerationService } from '@studio/playground/_components/hooks/useGenerationService';
import type { PlaygroundHistoryController } from '@studio/playground/_components/hooks/useHistory';
import { usePlaygroundMoodboards } from '@studio/playground/_components/hooks/usePlaygroundMoodboards';
import {
  getGalleryPromptCategory,
  getGalleryPromptCategoryLabel,
  getPromptCardThumbnailSource,
  shouldShowInGalleryImageWall,
  type GalleryPromptCategory,
} from '@studio/playground/_lib/prompt-history';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SplitText from '@/components/ui/split-text';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/common/use-toast';
import { resolveGalleryImageUrl } from '@/lib/gallery-asset';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from '@/lib/utils';
import type { SortBy } from '@/lib/server/service/history.service';
import type { Generation } from '@/types/database';

const PROMPT_INITIAL_RENDER_COUNT = 80;
const PROMPT_BATCH_RENDER_COUNT = 40;

type GalleryInnerTab = 'gallery' | 'prompt';

function useIncrementalVisibleCount(
  totalCount: number,
  initialCount: number,
  batchCount: number,
  resetSignal: string,
) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(totalCount, initialCount));

  useEffect(() => {
    setVisibleCount(Math.min(totalCount, initialCount));
  }, [initialCount, resetSignal, totalCount]);

  useEffect(() => {
    if (visibleCount >= totalCount) return;

    let cancelled = false;
    let timer: number | null = null;
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const flushNext = () => {
      if (cancelled) return;
      setVisibleCount((prev) => Math.min(totalCount, prev + batchCount));
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(flushNext);
    } else {
      timer = window.setTimeout(flushNext, 16);
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [batchCount, totalCount, visibleCount]);

  return visibleCount;
}

export default function GalleryView({
  onSelectItem,
  onUsePrompt,
  onUseImage,
  historyController,
}: {
  onSelectItem?: (item: Generation, items?: Generation[]) => void;
  onUsePrompt?: (item: Generation) => void;
  onUseImage?: (item: Generation) => void | Promise<void>;
  historyController?: Pick<PlaygroundHistoryController, 'setHistory' | 'getHistoryItem'>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [selectedPromptCategories, setSelectedPromptCategories] = useState<GalleryPromptCategory[]>([]);
  const [activeInnerTab, setActiveInnerTab] = useState<GalleryInnerTab>('gallery');
  const [isGalleryFilterOpen, setIsGalleryFilterOpen] = useState(false);
  const [isGalleryLayoutStable, setIsGalleryLayoutStable] = useState(false);

  const galleryItems = usePlaygroundStore((state) => state.galleryItems);
  const fetchGallery = usePlaygroundStore((state) => state.fetchGallery);
  const syncGalleryLatest = usePlaygroundStore((state) => state.syncGalleryLatest);
  const prefetchGalleryNext = usePlaygroundStore((state) => state.prefetchGalleryNext);
  const galleryPage = usePlaygroundStore((state) => state.galleryPage);
  const hasMoreGallery = usePlaygroundStore((state) => state.hasMoreGallery);
  const isFetchingGallery = usePlaygroundStore((state) => state.isFetchingGallery);
  const activeTab = usePlaygroundStore((state) => state.activeTab);
  const gallerySortBy = usePlaygroundStore((state) => state.gallerySortBy);
  const setGallerySortBy = usePlaygroundStore((state) => state.setGallerySortBy);
  const { handleGenerate } = useGenerationService(historyController);
  const { moodboards, moodboardCards, refreshMoodboardCards } = usePlaygroundMoodboards();

  const sortOptions: { value: Exclude<SortBy, 'interactionPriority'>; label: string }[] = [
    { value: 'recent', label: '最新' },
    { value: 'likes', label: '点赞最多' },
    { value: 'favorites', label: '收藏最多' },
    { value: 'downloads', label: '下载最多' },
    { value: 'edits', label: '编辑最多' },
  ];

  const currentSortOption = sortOptions.find((option) => option.value === gallerySortBy) || sortOptions[0];

  const availableModels = useMemo(() => {
    const models = new Set(
      galleryItems
        .map((item) => item.config?.model)
        .filter((model): model is string => Boolean(model)),
    );
    return Array.from(models).sort();
  }, [galleryItems]);

  const availablePresets = useMemo(() => {
    const presets = new Set(
      galleryItems
        .map((item) => item.config?.presetName)
        .filter((preset): preset is string => Boolean(preset)),
    );
    return Array.from(presets).sort();
  }, [galleryItems]);

  const imageItems = useMemo(
    () => galleryItems.filter((item) => shouldShowInGalleryImageWall(item)),
    [galleryItems],
  );

  const promptItems = useMemo(
    () => galleryItems.filter((item) => Boolean(item.config?.prompt?.trim())),
    [galleryItems],
  );

  const availablePromptCategories = useMemo(() => {
    const sourceItems = activeInnerTab === 'prompt' ? promptItems : imageItems;
    const categories = new Set<GalleryPromptCategory>(
      sourceItems.map((item) => getGalleryPromptCategory(item.config)),
    );
    return Array.from(categories);
  }, [activeInnerTab, imageItems, promptItems]);

  const buildFilteredItems = useCallback((items: Generation[]) => {
    let filtered = items;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => (item.config?.prompt || '').toLowerCase().includes(query));
    }

    if (selectedModels.length > 0) {
      filtered = filtered.filter(
        (item) => item.config?.model && selectedModels.includes(item.config.model),
      );
    }

    if (selectedPresets.length > 0) {
      filtered = filtered.filter(
        (item) => item.config?.presetName && selectedPresets.includes(item.config.presetName),
      );
    }

    if (selectedPromptCategories.length > 0) {
      filtered = filtered.filter((item) =>
        selectedPromptCategories.includes(getGalleryPromptCategory(item.config)),
      );
    }

    return filtered;
  }, [searchQuery, selectedModels, selectedPresets, selectedPromptCategories]);

  const filteredGalleryItems = useMemo(
    () => buildFilteredItems(imageItems),
    [buildFilteredItems, imageItems],
  );
  const filteredPromptItems = useMemo(
    () => buildFilteredItems(promptItems),
    [buildFilteredItems, promptItems],
  );

  const galleryLayoutKey = `${searchQuery.trim().toLowerCase()}|${selectedModels.join(',')}|${selectedPresets.join(',')}|${selectedPromptCategories.join(',')}|${gallerySortBy}`;
  const visiblePromptCount = useIncrementalVisibleCount(
    filteredPromptItems.length,
    PROMPT_INITIAL_RENDER_COUNT,
    PROMPT_BATCH_RENDER_COUNT,
    `${activeInnerTab}|${galleryLayoutKey}`,
  );
  const renderedPromptItems = useMemo(
    () => filteredPromptItems.slice(0, visiblePromptCount),
    [filteredPromptItems, visiblePromptCount],
  );

  useEffect(() => {
    setIsGalleryLayoutStable(false);
  }, [activeInnerTab, galleryLayoutKey]);

  useEffect(() => {
    if (activeTab !== 'gallery') return;
    if (galleryItems.length === 0 && !isFetchingGallery) {
      fetchGallery(1).catch((error) => console.error('Gallery initial load failed:', error));
    }
  }, [activeTab, fetchGallery, galleryItems.length, isFetchingGallery]);

  useEffect(() => {
    if (activeTab !== 'gallery' || activeInnerTab !== 'gallery') return;
    if (!isGalleryLayoutStable) return;
    if (galleryItems.length === 0) return;

    const timer = window.setTimeout(() => {
      syncGalleryLatest().catch((error) => console.error('Gallery latest sync failed:', error));
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeInnerTab, activeTab, galleryItems.length, isGalleryLayoutStable, syncGalleryLatest]);

  useEffect(() => {
    if (activeTab !== 'gallery') return;
    if (galleryItems.length === 0 || !hasMoreGallery || isFetchingGallery) return;

    const timer = window.setTimeout(() => {
      prefetchGalleryNext().catch((error) => console.error('Gallery prefetch failed:', error));
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeTab, galleryItems.length, hasMoreGallery, isFetchingGallery, galleryPage, prefetchGalleryNext]);

  const handleSelectItem = useCallback((item: Generation) => {
    if (item.status === 'pending') return;
    onSelectItem?.(item, filteredGalleryItems);
  }, [filteredGalleryItems, onSelectItem]);

  const handleDownload = useCallback((event: React.MouseEvent, imageUrl: string, filename: string) => {
    event.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMoreGallery || isFetchingGallery) return;
    fetchGallery(galleryPage + 1).catch((error) => console.error('Gallery load more failed:', error));
  }, [fetchGallery, galleryPage, hasMoreGallery, isFetchingGallery]);

  const toggleModel = useCallback((model: string) => {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
    );
  }, []);

  const togglePreset = useCallback((preset: string) => {
    setSelectedPresets((current) =>
      current.includes(preset) ? current.filter((item) => item !== preset) : [...current, preset],
    );
  }, []);

  const togglePromptCategory = useCallback((category: GalleryPromptCategory) => {
    setSelectedPromptCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }, []);

  const isInitialLoading = activeTab === 'gallery' && isFetchingGallery && galleryItems.length === 0;
  const searchPlaceholder =
    activeInnerTab === 'gallery' ? 'Search gallery prompts...' : 'Search prompt records...';

  return (
    <TooltipProvider delayDuration={100}>
      <div
        data-testid="gallery-view-root"
        className="mx-auto flex min-h-0 flex-1 w-[95%] flex-col overflow-hidden bg-transparent pt-10"
      >
        <div data-testid="gallery-view-shell" className="relative flex min-h-0 flex-1 w-full overflow-hidden">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div data-testid="gallery-view-stack" className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
              <div className="mt-4 flex h-14 shrink-0 flex-row items-center justify-between gap-4">
                <div className="flex mb-0 items-center gap-5 font-serif">
                  <GalleryHeaderTab
                    label="Gallery"
                    isActive={activeInnerTab === 'gallery'}
                    onClick={() => setActiveInnerTab('gallery')}
                  />
                  <GalleryHeaderTab
                    label="Prompt"
                    isActive={activeInnerTab === 'prompt'}
                    onClick={() => setActiveInnerTab('prompt')}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex items-center group w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white group-focus-within:text-white/60" />
                    <input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 focus:bg-black/80"
                    />
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white gap-2"
                      >
                        <span className="text-sm">{currentSortOption.label}</span>
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-black/90 border-white/10">
                      {sortOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setGallerySortBy(option.value)}
                          className={cn(
                            'flex items-center gap-2 cursor-pointer text-white/70 hover:text-white hover:bg-white/10',
                            gallerySortBy === option.value && 'bg-white/10 text-white',
                          )}
                        >
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    onClick={() => setIsGalleryFilterOpen((current) => !current)}
                    className={cn(
                      'h-10 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white gap-2 px-3',
                      isGalleryFilterOpen && 'bg-white/10 text-white border-white/20',
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="text-sm">Filters</span>
                    {(selectedModels.length > 0 ||
                      selectedPresets.length > 0 ||
                      selectedPromptCategories.length > 0) ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ) : null}
                  </Button>
                </div>
              </div>

              <div data-testid="gallery-view-body" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl">
                {activeInnerTab === 'gallery' ? (
                  <GalleryImageWall
                    items={filteredGalleryItems}
                    layoutKey={galleryLayoutKey}
                    isInitialLoading={isInitialLoading}
                    isFetchingGallery={isFetchingGallery}
                    hasMoreGallery={hasMoreGallery}
                    onLoadMore={handleLoadMore}
                    onLayoutStableChange={setIsGalleryLayoutStable}
                    onSelectItem={handleSelectItem}
                    onDownload={handleDownload}
                    onGenerate={handleGenerate}
                    onUsePrompt={onUsePrompt}
                    onUseImage={onUseImage}
                    moodboards={moodboards}
                    moodboardCards={moodboardCards}
                    refreshMoodboardCards={refreshMoodboardCards}
                  />
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <PromptListView items={renderedPromptItems} onUsePrompt={onUsePrompt} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isGalleryFilterOpen ? (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 z-50 w-80 flex flex-col min-h-0 pointer-events-auto"
              >
                <div className="bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 flex flex-col min-h-0 h-[84vh] overflow-y-auto overflow-hidden shadow-2xl">
                  <div className="p-4 pt-6 flex flex-col gap-4 flex-1 min-h-0">
                    <div className="flex items-center px-2 justify-between z-20 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsGalleryFilterOpen(false)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                          title="Close Filters"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <span className="font-serif text-xl text-white">Filters</span>
                      </div>

                      {(selectedModels.length > 0 ||
                        selectedPresets.length > 0 ||
                        selectedPromptCategories.length > 0) ? (
                        <button
                          onClick={() => {
                            setSelectedModels([]);
                            setSelectedPresets([]);
                            setSelectedPromptCategories([]);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                          title="Clear Filters"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2">
                      <div className="flex flex-col gap-6">
                        {availableModels.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm text-white/40">Models</div>
                            <div className="space-y-1">
                              {availableModels.map((model, index) => (
                                <FilterItem
                                  key={`filter-model-${model}-${index}`}
                                  label={model}
                                  isSelected={selectedModels.includes(model)}
                                  onClick={() => toggleModel(model)}
                                  icon={Box}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {availablePromptCategories.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm text-white/40">Prompt Categories</div>
                            <div className="space-y-1">
                              {availablePromptCategories.map((category) => (
                                <FilterItem
                                  key={`filter-prompt-category-${category}`}
                                  label={getGalleryPromptCategoryLabel(category)}
                                  isSelected={selectedPromptCategories.includes(category)}
                                  onClick={() => togglePromptCategory(category)}
                                  icon={Type}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {availablePresets.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm text-white/40">Presets</div>
                            <div className="space-y-1">
                              {availablePresets.map((preset, index) => (
                                <FilterItem
                                  key={`filter-preset-${preset}-${index}`}
                                  label={preset}
                                  isSelected={selectedPresets.includes(preset)}
                                  onClick={() => togglePreset(preset)}
                                  icon={SlidersHorizontal}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
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

function FilterItem({
  label,
  isSelected,
  onClick,
  icon: Icon,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm',
        isSelected
          ? 'bg-white/5 text-white border border-white/10'
          : 'text-white/60 hover:bg-black/10 hover:text-white',
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', isSelected ? 'text-primary' : 'text-white/40')} />
      <span className="truncate flex-1 select-none">{label}</span>
    </div>
  );
}

function PromptListView({
  items,
  onUsePrompt,
}: {
  items: Generation[];
  onUsePrompt?: (item: Generation) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
        No prompt records yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <PromptCard key={`${item.id}-${index}`} item={item} onUsePrompt={onUsePrompt} />
      ))}
    </div>
  );
}

function PromptCard({
  item,
  onUsePrompt,
}: {
  item: Generation;
  onUsePrompt?: (item: Generation) => void;
}) {
  const { toast } = useToast();
  const promptCategory = getGalleryPromptCategory(item.config);
  const promptCategoryLabel = getGalleryPromptCategoryLabel(promptCategory);
  const prompt = item.config?.prompt || '';
  const thumbnailSource = getPromptCardThumbnailSource(item);
  const thumbnailUrl = useMemo(
    () => (thumbnailSource ? resolveGalleryImageUrl(thumbnailSource) : ''),
    [thumbnailSource],
  );

  const handleUsePrompt = () => {
    if (!prompt) return;

    if (onUsePrompt) {
      onUsePrompt(item);
    } else {
      usePlaygroundStore.getState().applyPrompt(prompt);
    }

    toast({
      title: 'Prompt Applied',
      description: '提示词已应用到输入框',
    });
  };

  return (
    <button
      type="button"
      onClick={handleUsePrompt}
      className="group flex min-h-[220px] w-full flex-col rounded-2xl border border-white/10 bg-black/20 p-5 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {thumbnailUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white/5">
              <Image
                src={thumbnailUrl}
                alt="Prompt source thumbnail"
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] text-white/65 uppercase">
            {promptCategoryLabel}
          </span>
        </div>
        <span className="text-[10px] text-white/30 font-mono uppercase">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] text-white/35">
        <span>{item.config?.model || 'Unknown Model'}</span>
        {item.config?.presetName ? <span>/ {item.config.presetName}</span> : null}
      </div>
      <p className="mt-4 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/82 line-clamp-[10]">
        {prompt || '暂无提示词'}
      </p>
      <div className="mt-4 text-[11px] text-white/25 transition-colors group-hover:text-white/55">
        Click to use prompt
      </div>
    </button>
  );
}
