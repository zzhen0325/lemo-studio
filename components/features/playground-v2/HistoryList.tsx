import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { FolderPlus, Image as ImageIcon, LayoutGrid, List, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Generation } from '@/types/database';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AddToProjectDialog } from './Dialogs/AddToProjectDialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { HistoryLoadingSkeleton } from './HistoryLoadingSkeleton';
import { useGroupedHistory, isTextHistoryResult } from '@/components/features/playground-v2/hooks/useGroupedHistory';
import {
  DescribeSourceImage,
  DraggableHistoryCard,
  HistoryCard,
  TextHistoryCard,
} from '@/components/features/playground-v2/history/HistoryCards';
import type { HistoryListProps } from '@/components/features/playground-v2/history/types';

const HistoryList = observer(function HistoryList({
  history,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  variant = 'default',
  onLayoutModeChange,
  layoutMode = 'list',
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: HistoryListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const {
    setPreviewImage,

    isSelectionMode,
    setIsSelectionMode,
    selectedHistoryIds: selectedIds,
    toggleHistorySelection: toggleSelection,
    clearHistorySelection: clearSelection,
  } = usePlaygroundStore();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1, root: scrollRef.current, rootMargin: '400px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);


  const groupedHistory = useGroupedHistory(history);

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

  const getSelectedItems = () => {
    return history.filter(item => selectedIds.has(item.id));
  };

  if (history.length === 0) {
    if (isLoading) {
      return <HistoryLoadingSkeleton layoutMode={layoutMode} />;
    }
    return null;
  }



  //主容器

  return (

    // bg-white/5 border border-white/10 rounded-3xl
    <div
      className=" rounded-3xl h-full flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-4 right-6 z-40 flex items-center gap-2">
        <div className="flex items-center p-1 gap-1 bg-black/20 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20">
          <button
            onClick={() => onLayoutModeChange?.('grid')}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              layoutMode === 'grid'
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title="Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLayoutModeChange?.('list')}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              layoutMode === 'list'
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title="List View"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>





      {/* Header Actions: 标题、视图切换 & 关闭 (层级 z-20，确保在模糊 z-10 上方) */}
      {/* <div className="flex items-center justify-between px-6 pt-4 pb-2 z-20 shrink-0">


        <div className="flex z-20">
          <span className="text-white text-2xl"
            style={{ fontFamily: "'InstrumentSerif', serif" }}
          >History</span>
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
            history.map((result, resultIdx) => {
              if (isTextHistoryResult(result)) {
                return null;
              }

              const normalizedId = (result.id || '').trim();
              const resultKey = normalizedId || `history-item-${result.createdAt || 'unknown'}-${resultIdx}`;

              return (
                <div key={resultKey} className="break-inside-avoid mb-4">
                  <DraggableHistoryCard
                    result={result}
                    selectedIds={selectedIds}
                    isSelectionMode={isSelectionMode}
                  >
                    <HistoryCard
                      result={result}
                      onRegenerate={onRegenerate}
                      onDownload={onDownload}
                      onEdit={onEdit}
                      onImageClick={onImageClick}
                      onRefImageClick={(url, id) => {
                        setPreviewImage(url, id);
                      }}
                      layoutMode={layoutMode}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(result.id)}
                      onToggleSelect={() => {
                        usePlaygroundStore.getState().toggleHistorySelection(result.id);
                      }}
                    />
                  </DraggableHistoryCard>
                </div>
              );
            })
          ) : (
            groupedHistory.map((group, groupIdx) => {
              const isGroupSelected = group.items.every(item => selectedIds.has(item.id));

              return (
                <div
                  key={`group-${groupIdx}`}
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
                          onRefImageClick={(url, id) => {
                            setPreviewImage(url, id);
                          }}
                          layoutMode={layoutMode}
                          isSelectionMode={isSelectionMode}
                          isSelected={isGroupSelected} // In list mode, the card represents the group
                          onToggleSelect={() => toggleGroupSelection(group.items)}
                        />
                      </DraggableHistoryCard>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6 group/card">
                      <div className="flex items-center justify-between gap-4 text-[10px] text-white/30 font-mono uppercase ">
                        <div className="flex items-center gap-4">
                          <span>{new Date(group.startAt).toLocaleString()}</span>
                          <span className="opacity-40">/</span>
                          <span className="text-white/40">Image Analysis</span>
                        </div>
                      </div>

                      <div className="relative bg-transparent grid grid-cols-[minmax(0,1.8fr)_minmax(0,4fr)] gap-2 items-stretch content-start">
                        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 group/img">
                          {group.sourceImage ? (
                            <DescribeSourceImage
                              sourceImage={group.sourceImage}
                              generationId={group.items[0].id}
                              onPreview={setPreviewImage}
                            />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-white/10" />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {group.items.map((item, itemIdx) => (
                            <DraggableHistoryCard
                              key={`${item.id}-${itemIdx}`}
                              result={item}
                              selectedIds={selectedIds}
                              isSelectionMode={isSelectionMode}
                            >
                              <TextHistoryCard
                                result={item}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedIds.has(item.id)}
                                onToggleSelect={() => toggleSelection(item.id)}
                              />
                            </DraggableHistoryCard>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Load More Sentinel & Indicator */}
        <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center gap-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinner size={24} className="text-white/20" />
              <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Loading More...</span>
            </div>
          ) : hasMore ? (
            <div className="h-4" />
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
                  className="h-8 rounded-full hover:bg-white/10 text-white gap-2"
                  onClick={() => setIsAddToProjectOpen(true)}
                >
                  <FolderPlus className="w-4 h-4" />
                  Add to Project
                </Button>
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

      <AddToProjectDialog
        open={isAddToProjectOpen}
        onOpenChange={setIsAddToProjectOpen}
        selectedItems={getSelectedItems()}
        onSuccess={() => {
          setIsSelectionMode(false);
          clearSelection();
        }}
      />
    </div>
  );
});

export default HistoryList;
