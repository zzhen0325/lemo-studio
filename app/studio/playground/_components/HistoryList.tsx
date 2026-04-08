import React, { useEffect, useRef } from 'react';
import { Image as ImageIcon, LayoutGrid, List, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Generation } from '@/types/database';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { HistoryLoadingSkeleton } from './HistoryLoadingSkeleton';
import { useGroupedHistory, isTextHistoryResult } from '@studio/playground/_components/hooks/useGroupedHistory';
import { usePlaygroundMoodboards } from '@studio/playground/_components/hooks/usePlaygroundMoodboards';
import {
  DescribeSourceImage,
  DraggableHistoryCard,
  HistoryCard,
  TextHistoryCard,
} from '@studio/playground/_components/history/HistoryCards';
import type { HistoryListProps } from '@studio/playground/_components/history/types';
import {
  getPromptOptimizationSource,
  isPromptOptimizationHistoryItem,
} from '@studio/playground/_lib/prompt-history';

const HISTORY_INITIAL_RENDER_COUNT = 60;
const HISTORY_BATCH_RENDER_COUNT = 30;
const HISTORY_LOADING_SKELETON_DELAY_MS = 140;

function useIncrementalVisibleCount(
  totalCount: number,
  initialCount: number,
  batchCount: number,
  resetSignal: string
) {
  const [visibleCount, setVisibleCount] = React.useState(() => Math.min(totalCount, initialCount));
  const previousResetSignalRef = React.useRef(resetSignal);

  useEffect(() => {
    const didResetSignalChange = previousResetSignalRef.current !== resetSignal;
    previousResetSignalRef.current = resetSignal;

    setVisibleCount((prev) => {
      if (totalCount === 0) {
        return 0;
      }

      if (didResetSignalChange) {
        return Math.min(totalCount, initialCount);
      }

      if (prev === 0) {
        return Math.min(totalCount, initialCount);
      }

      if (totalCount < prev) {
        return totalCount;
      }

      return prev;
    });
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
      idleId = win.requestIdleCallback(() => {
        flushNext();
      });
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

const HistoryList = function HistoryList({
  history,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  onUsePrompt,
  onBatchUse,
  variant = 'default',
  onLayoutModeChange,
  layoutMode = 'list',
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
}: HistoryListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const setPreviewImage = usePlaygroundStore((state) => state.setPreviewImage);
  const isSelectionMode = usePlaygroundStore((state) => state.isSelectionMode);
  const setIsSelectionMode = usePlaygroundStore((state) => state.setIsSelectionMode);
  const selectedIds = usePlaygroundStore((state) => state.selectedHistoryIds);
  const toggleSelection = usePlaygroundStore((state) => state.toggleHistorySelection);
  const clearSelection = usePlaygroundStore((state) => state.clearHistorySelection);
  const { moodboards, moodboardCards, refreshMoodboardCards } = usePlaygroundMoodboards();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0, root: scrollRef.current, rootMargin: '1200px 0px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);
  const groupedHistory = useGroupedHistory(history);
  const visibilityResetSignal = `${variant}|${layoutMode}`;
  const visibleHistoryCount = useIncrementalVisibleCount(
    history.length,
    HISTORY_INITIAL_RENDER_COUNT,
    HISTORY_BATCH_RENDER_COUNT,
    visibilityResetSignal
  );
  const visibleGridHistory = React.useMemo(
    () => history.slice(0, visibleHistoryCount),
    [history, visibleHistoryCount]
  );
  const visibleGroupedHistory = React.useMemo(() => {
    if (visibleHistoryCount >= history.length) {
      return groupedHistory;
    }

    let consumed = 0;
    const acc: typeof groupedHistory = [];
    for (const group of groupedHistory) {
      if (consumed >= visibleHistoryCount) break;
      acc.push(group);
      consumed += group.items.length;
    }
    return acc;
  }, [groupedHistory, history.length, visibleHistoryCount]);

  const [shouldShowInitialSkeleton, setShouldShowInitialSkeleton] = React.useState(false);

  useEffect(() => {
    if (!isLoading || history.length > 0) {
      setShouldShowInitialSkeleton(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldShowInitialSkeleton(true);
    }, HISTORY_LOADING_SKELETON_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [history.length, isLoading]);

  const toggleGroupSelection = (items: Generation[]) => {
    const allSelected = items.every(item => selectedIds.has(item.id));

    if (allSelected) {
      items.forEach(item => {
        if (selectedIds.has(item.id)) toggleSelection(item.id);
      });
    } else {
      items.forEach(item => {
        if (!selectedIds.has(item.id)) toggleSelection(item.id);
      });
    }
  };

  if (history.length === 0) {
    if (shouldShowInitialSkeleton) {
      return <HistoryLoadingSkeleton layoutMode={layoutMode} />;
    }
    return null;
  }



  //主容器

  return (

    // bg-white/5 border border-white/10 rounded-3xl
    <TooltipProvider delayDuration={100}>
    <div
      className=" rounded-2xl h-full flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-4 right-0 z-40 flex items-center gap-2">
        <div className="flex items-center p-1 gap-1 bg-black/20 backdrop-blur-xl rounded-md border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20">
          <button
            onClick={() => onLayoutModeChange?.('grid')}
            className={cn(
              "p-1.5 rounded-sm transition-all",
              layoutMode === 'grid'
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title="Grid View"
          >
            <LayoutGrid className="w-3 h-3" />
          </button>
          <button
            onClick={() => onLayoutModeChange?.('list')}
            className={cn(
              "p-1.5 rounded-sm transition-all",
              layoutMode === 'list'
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title="List View"
          >
            <List className="w-3 h-3" />
          </button>
        </div>
      </div>





      {/* Header Actions: 标题、视图切换 & 关闭 (层级 z-20，确保在模糊 z-10 上方) */}
      {/* <div className="flex items-center justify-between px-6 pt-4 pb-2 z-20 shrink-0">


        <div className="flex z-20">
          <span className="text-white text-2xl font-serif">History</span>
        </div>

        <div className="flex items-center gap-3 z-20">
          <div className="flex items-center p-1 gap-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
            <div className='flex gap-2'>
             
              <AnimatePresence>
                {isSelectionMode && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm  text-white/60 hover:text-white hover:bg-white/10"
                      onClick={handleSelectAll}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm text-white/60 hover:text-white hover:bg-white/10"
                      onClick={handleDeselectAll}
                    >
                      Cancel
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />
            <button
              onClick={() => onLayoutModeChange?.('grid')}
              className={cn(
                "p-1.5 rounded-md transition-all",
                layoutMode === 'grid'
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onLayoutModeChange?.('list')}
              className={cn(
                "p-1.5 rounded-md transition-all",
                layoutMode === 'list'
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center h-9 w-9  justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="w-4 h-4 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
          </button>
        </div>

      </div> */}

      {/* <button
        onClick={() => {
          setIsSelectionMode(!isSelectionMode);
          if (isSelectionMode) clearSelection(); // Clear selection on exit
        }}
        className={cn(
          " px-2 rounded-md flex items-center gap-2 transition-all",
          isSelectionMode
            ? "bg-white/10 text-primary"
            : "text-white/40 hover:text-white hover:bg-white/5"
        )}
        title="Select Mode"
      >

        <Folder className="w-3.5 h-3.5" />
        <span className='text-sm'>Manager</span>
      </button> */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto  z-30  ",
          variant === 'default' ? "mt-0" : "mt-2"
        )}
      >

        <div className={cn(
          layoutMode === 'list'
            ? "flex flex-col gap-8 w-full mt-4 mx-auto"
            : "columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 space-y-2 mt-4 w-full mx-auto",
          variant === 'default' ? "max-w-[1600px]" : "max-w-full"
        )}>
          {layoutMode === 'grid' ? (
            visibleGridHistory.map((result, resultIdx) => {
              const normalizedId = (result.id || '').trim();
              const resultKey = normalizedId || `history-item-${result.createdAt || 'unknown'}-${resultIdx}`;
              const isTextItem = isTextHistoryResult(result);
              const isOptimizationItem = isPromptOptimizationHistoryItem(result);

              return (
                <div key={resultKey} className="break-inside-avoid mb-4">
                  <DraggableHistoryCard
                    result={result}
                    selectedIds={selectedIds}
                    isSelectionMode={isSelectionMode}
                  >
                    {isTextItem || isOptimizationItem ? (
                      <TextHistoryCard
                        result={result}
                        title={isOptimizationItem
                          ? (getPromptOptimizationSource(result.config)?.activeVariantLabel || 'Optimized Prompt')
                          : 'Image Analysis'}
                        actionLabel={isOptimizationItem ? 'Use Variant' : 'Use Prompt'}
                        onUsePrompt={onUsePrompt}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(result.id)}
                        onToggleSelect={() => {
                          usePlaygroundStore.getState().toggleHistorySelection(result.id);
                        }}
                      />
                    ) : (
                      <HistoryCard
                        result={result}
                        onRegenerate={onRegenerate}
                        onDownload={onDownload}
                        onEdit={onEdit}
                        onImageClick={onImageClick}
                        onUsePrompt={onUsePrompt}
                        onRefImageClick={(url, id) => {
                          setPreviewImage(url, id);
                        }}
                        layoutMode={layoutMode}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(result.id)}
                        onToggleSelect={() => {
                          usePlaygroundStore.getState().toggleHistorySelection(result.id);
                        }}
                        moodboards={moodboards}
                        moodboardCards={moodboardCards}
                        refreshMoodboardCards={refreshMoodboardCards}
                      />
                    )}
                  </DraggableHistoryCard>
                </div>
              );
            })
          ) : (
            visibleGroupedHistory.map((group) => {
              const isGroupSelected = group.items.every(item => selectedIds.has(item.id));

              return (
                <div
                  key={group.key}
                  className={cn(
                    "break-inside-avoid flex flex-col overflow-hidden mb-2  transition-all",
                    isSelectionMode ? "cursor-pointer border-2 p-2 rounded-3xl " : "bg-transparent border-0",
                    isSelectionMode && isGroupSelected ? "border-primary/20 bg-white/5" : (isSelectionMode ? "border-transparent hover:bg-white/5" : "")
                  )}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleGroupSelection(group.items);
                    }
                  }}
                >
                  {group.type === 'image' ? (
                    <div className="flex flex-col">
                      <DraggableHistoryCard
                        result={group.items[0]}
                        selectedIds={selectedIds}
                        isSelectionMode={isSelectionMode}
                      >
                        <HistoryCard
                          result={group.items[0]}
                          allResults={group.items}
                          onRegenerate={onRegenerate}
                          onDownload={onDownload}
                          onEdit={onEdit}
                          onImageClick={onImageClick}
                          onUsePrompt={onUsePrompt}
                          onRefImageClick={(url, id) => {
                            setPreviewImage(url, id);
                          }}
                          layoutMode={layoutMode}
                          isSelectionMode={isSelectionMode}
                          isSelected={isGroupSelected} // In list mode, the card represents the group
                          onToggleSelect={() => toggleGroupSelection(group.items)}
                          moodboards={moodboards}
                          moodboardCards={moodboardCards}
                          refreshMoodboardCards={refreshMoodboardCards}
                        />
                      </DraggableHistoryCard>
                    </div>
                  ) : group.type === 'text' ? (
                    <div className="flex flex-col gap-4 group/card">
                      <div className="flex items-center justify-between gap-4 text-[12px] text-white/30 font-mono tracking-tight px-1">
                        <div className="flex items-center gap-4">
                           <span className="text-white/40">Image Analysis</span>
                        
                          <span className="opacity-40">/</span>
                            <span>{new Date(group.startAt).toLocaleString()}</span>
                         
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative h-full bg-transparent grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-4 items-stretch content-start">
                          <div className="relative w-full h-[220px] overflow-hidden rounded-xl border border-white/10 bg-white/5 group/img">
                            {group.sourceImage ? (
                              <DescribeSourceImage
                                sourceImage={group.sourceImage}
                                generationId={group.items[0].id}
                                onPreview={setPreviewImage}
                              />
                            ) : (
                              <div className="w-full h-[220px] bg-white/5 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-white/10" />
                              </div>
                            )}
                          </div>

                          <div className="col-span-4 grid grid-cols-4 gap-2">
                            {group.items.map((item, itemIdx) => (
                              <DraggableHistoryCard
                                key={`${item.id}-${itemIdx}`}
                                result={item}
                                selectedIds={selectedIds}
                                isSelectionMode={isSelectionMode}
                              >
                                <TextHistoryCard
                                  result={item}
                                  title="Image Analysis"
                                  onUsePrompt={onUsePrompt}
                                  isSelectionMode={isSelectionMode}
                                  isSelected={selectedIds.has(item.id)}
                                  onToggleSelect={() => toggleSelection(item.id)}
                                />
                              </DraggableHistoryCard>
                            ))}
                          </div>
                        </div>

                        {group.items.length > 0 && !isSelectionMode && (
                          <div className="flex gap-2 px-1 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-sm border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onBatchUse) {
                                  onBatchUse(group.items, group.sourceImage);
                                }
                              }}
                            >
                              <span className="text-md hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">Generate ALL</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 group/card">
                      <div className="flex items-center justify-between gap-4 text-[10px] text-white/30 font-mono uppercase ">
                        <div className="flex items-center gap-4">
                          <span>{new Date(group.startAt).toLocaleString()}</span>
                          <span className="opacity-40">/</span>
                          <span className="text-white/40">Prompt Optimization</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-4 items-stretch content-start">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4 overflow-hidden h-[220px]">
                          <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono uppercase tracking-[0.2em]">
                            <span className="block w-1 h-1 rounded-full bg-white/20" />
                            Original Prompt
                          </div>
                          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            <p className="text-[12px] leading-relaxed text-white/85 whitespace-pre-wrap break-words">
                              {group.originalPrompt || group.items[0]?.config?.prompt || 'Untitled prompt'}
                            </p>
                          </div>
                        </div>

                        <div className="col-span-4 grid grid-cols-4 gap-2">
                          {group.items.map((item, itemIdx) => (
                            <DraggableHistoryCard
                              key={`${item.id}-${itemIdx}`}
                              result={item}
                              selectedIds={selectedIds}
                              isSelectionMode={isSelectionMode}
                            >
                              <TextHistoryCard
                                result={item}
                                title={getPromptOptimizationSource(item.config)?.activeVariantLabel || `Optimized Prompt ${itemIdx + 1}`}
                                actionLabel="Use Variant"
                                onUsePrompt={onUsePrompt}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedIds.has(item.id)}
                                onToggleSelect={() => toggleSelection(item.id)}
                              />
                            </DraggableHistoryCard>
                          ))}
                        </div>
                      </div>

                      {group.items.length > 0 && !isSelectionMode && (
                        <div className="flex gap-2 px-1 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-sm border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onBatchUse) {
                                onBatchUse(group.items);
                              }
                            }}
                          >
                            <span className="text-md hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">Use ALL</span>
                          </Button>
                          </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Load More Sentinel & Indicator */}
        <div ref={loadMoreRef} className="min-h-24 py-12 flex flex-col items-center justify-center gap-4">
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinner size={24} className="text-white/20" />
              <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Loading more...</span>
            </div>
          ) : hasMore ? (
            <div className="flex flex-col items-center gap-2 opacity-30">
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
              <span className="text-[10px] text-white font-mono uppercase tracking-widest">Scroll for more</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-20">
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
              <span className="text-[10px] text-white font-mono uppercase tracking-widest">End of History</span>
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
            >

            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-60 left-1/2 -translate-x-1/2 z-30 w-fit"
            >
              <div className="flex items-center gap-3 px-4 py-2 bg-black/20 backdrop-blur-xl  rounded-3xl shadow-2xl">
                <span className="text-md text-white/80 px-2">
                  {selectedIds.size} selected
                </span>
                <div className="w-[1px] h-4 bg-white/10" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full hover:bg-red-500/10 text-red-500 hover:text-red-400 gap-2"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
                      usePlaygroundStore.getState().deleteHistory(Array.from(selectedIds));
                      setIsSelectionMode(false);
                      clearSelection();
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </TooltipProvider>
  );
};

export default HistoryList;
