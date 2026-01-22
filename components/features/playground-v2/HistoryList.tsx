import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { projectStore } from '@/lib/store/project-store';


import Image from "next/image";
import { Download, Type, Image as ImageIcon, Box, RefreshCw, Copy, FolderPlus, GripVertical, Bookmark, Pencil, Trash2, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Generation } from '@/types/database';
import { AVAILABLE_MODELS } from "@/hooks/features/PlaygroundV2/useGenerationService";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useImageSource } from '@/hooks/common/use-image-source';
import { cn } from "@/lib/utils";
import { formatImageUrl } from '@/lib/api-base';
import { useToast } from "@/hooks/common/use-toast";
import { isWorkflowModel } from '@/lib/utils/model-utils';
import { motion, AnimatePresence } from "framer-motion";
import { AddToProjectDialog } from "./Dialogs/AddToProjectDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { HistoryLoadingSkeleton } from './HistoryLoadingSkeleton';
import { useDraggable } from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";


interface HistoryListProps {
  history: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
  onEdit?: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  isGenerating?: boolean;
  variant?: 'default' | 'sidebar';
  onBatchUse?: (results: Generation[], sourceImage?: string) => void;
  layoutMode?: 'grid' | 'list';
  onLayoutModeChange?: (mode: 'grid' | 'list') => void;
  onClose?: () => void;
}

interface GroupedHistoryItem {
  type: 'image' | 'text';
  key: string;
  items: Generation[];
  sourceImage?: string;
  startAt: string;
}

const HistoryList = observer(function HistoryList({
  history,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  variant = 'default',

  layoutMode = 'list',
}: HistoryListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const {
    setPreviewImage,

    isSelectionMode,
    setIsSelectionMode,
    selectedHistoryIds: selectedIds,
    toggleHistorySelection: toggleSelection,
    clearHistorySelection: clearSelection,
    historyPage,
    hasMoreHistory,
    isFetchingHistory,
    fetchHistory
  } = usePlaygroundStore();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreHistory && !isFetchingHistory) {
          fetchHistory(historyPage + 1, projectStore.currentProjectId || undefined);
        }
      },
      { threshold: 0.1, root: scrollRef.current }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreHistory, isFetchingHistory, historyPage, fetchHistory]);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);


  // Group history by taskId
  const groupedHistory = React.useMemo(() => {
    const map = new Map<string, GroupedHistoryItem>();
    history.forEach((result) => {
      // 数据已规范化，直接从 config.sourceImageUrls 读取
      const sourceUrls: string[] = result.config?.sourceImageUrls ||
        (result.config?.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
      const firstSourceUrl = sourceUrls[0];
      const isText = !!firstSourceUrl && (result.outputUrl === firstSourceUrl);
      const type: 'image' | 'text' = isText ? 'text' : 'image';

      // Use taskId as the primary grouping key. If taskId is missing, fallback to item id.
      // This ensures that batch generations (sharing same taskId) are grouped together.
      const taskId = result.config?.taskId;
      const key = taskId
        ? `task|${taskId}`
        : `item|${result.id}`;

      const existing = map.get(key);
      if (existing) {
        existing.items.push(result);
        // Ensure startAt is the earliest creation time in the group
        if (new Date(result.createdAt).getTime() < new Date(existing.startAt).getTime()) {
          existing.startAt = result.createdAt;
        }
      } else {
        map.set(key, {
          type,
          key,
          items: [result],
          sourceImage: type === 'text' ? firstSourceUrl : undefined,
          startAt: result.createdAt,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [history]);

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
    if (isFetchingHistory) {
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
            history.map((result, idx) => {
              // 数据已规范化，直接从 config.sourceImageUrls 读取
              const sourceUrls: string[] = result.config?.sourceImageUrls ||
                (result.config?.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
              const firstSourceUrl = sourceUrls[0];
              const isText = !!firstSourceUrl && (result.outputUrl === firstSourceUrl);

              if (isText) {
                return null;
              }

              return (
                <div key={`${result.id}-${idx}`} className="break-inside-avoid mb-4">
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
                      onToggleSelect={() => toggleSelection(result.id)}
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
          {isFetchingHistory ? (
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinner size={24} className="text-white/20" />
              <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Loading More...</span>
            </div>
          ) : hasMoreHistory ? (
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

function DescribeSourceImage({
  sourceImage,
  generationId,
  onPreview
}: {
  sourceImage: string;
  generationId: string;
  onPreview: (url: string, id: string) => void;
}) {
  const src = useImageSource(sourceImage);

  if (!src) return (
    <div className="w-full h-full bg-white/5 flex items-center justify-center">
      <ImageIcon className="w-6 h-6 text-white/10" />
    </div>
  );

  return (
    <motion.div
      layoutId={`img-ref-${generationId}`}
      className="w-full"
    >
      <Image
        src={src}
        alt="Source for describe"
        width={1024}
        height={1024}
        className="w-full h-auto cursor-pointer transition-transform duration-500 rounded-xl group-hover/img:scale-[1.05]"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(src, `img-ref-${generationId}`);
        }}
        unoptimized
      />
    </motion.div>
  );
}

function HistoryReferenceImage({
  url,
  idx,
  resultId,
  onRefImageClick
}: {
  url: string;
  idx: number;
  resultId: string;
  onRefImageClick: (url: string, id: string) => void
}) {
  const src = useImageSource(url);
  const displayUrl = src || formatImageUrl(url);
  const layoutId = `img-ref-${resultId}-${idx}`;

  return (
    <div className="group/ref relative">
      <motion.div
        layoutId={layoutId}
        className="relative w-12 aspect-square rounded-lg border border-white/10 overflow-hidden cursor-pointer hover:border-white/30 transition-all shadow-lg"
        onClick={(e) => {
          e.stopPropagation();
          onRefImageClick(displayUrl, layoutId);
        }}
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={`Ref ${idx + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : null}
        <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-black/60 backdrop-blur-[2px] rounded text-[7px] text-white/70 uppercase font-bold border border-white/5">
          {idx + 1}
        </div>
      </motion.div>
    </div>
  );
}

function DraggableHistoryCard({
  result,
  selectedIds,
  children,
  isSelectionMode,
}: {
  result: Generation;
  selectedIds: Set<string>;
  children: React.ReactNode;
  isSelectionMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `history-${result.id}`,
    data: {
      type: 'history-item',
      generation: result,
      selectedIds: Array.from(selectedIds),
    },
    disabled: !isSelectionMode || !selectedIds.has(result.id),
  });

  const style = transform ? {
    transform: isDragging ? undefined : `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative",
        isDragging && "cursor-grabbing",
        isSelectionMode && selectedIds.has(result.id) && "cursor-grab"
      )}
    >
      {children}
      {isSelectionMode && selectedIds.has(result.id) && !isDragging && (
        <div className="absolute top-2 left-2 z-30 p-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10 text-white/60">
          <GripVertical className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  result,
  allResults,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  onRefImageClick,
  layoutMode = 'list',
  isSelectionMode,
  isSelected,
  onToggleSelect
}: {
  result: Generation;
  allResults?: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
  onEdit?: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onRefImageClick: (url: string, id: string) => void;
  layoutMode?: 'grid' | 'list';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [isHover, setIsHover] = React.useState(false);
  const { applyPrompt, applyModel, applyImage, applyImages, styles, addImageToStyle, setSelectedPresetName } = usePlaygroundStore();
  const { toast } = useToast();

  // 数据已规范化，直接从 config.sourceImageUrls 读取
  const sourceUrls = React.useMemo<string[]>(() => {
    return result.config?.sourceImageUrls || [];
  }, [result.config?.sourceImageUrls]);

  const mainImage = formatImageUrl(result.outputUrl);

  const config = result.config;
  const isWorkflow = isWorkflowModel(config?.model);
  const modelDisplayName = AVAILABLE_MODELS.find(m => m.id === config?.model)?.displayName || config?.model || 'Unknown';
  const baseModelDisplayName = config?.baseModel ? (AVAILABLE_MODELS.find(m => m.id === config.baseModel)?.displayName || config.baseModel) : undefined;
  const prompt = config?.prompt || '';
  const timeStr = new Date(result.createdAt).toLocaleString();

  if (layoutMode === 'list') {
    const resultsToDisplay = allResults || [result];
    const width = config?.width || 1024;
    const height = config?.height || 1024;
    const isWide = width / height > 1.2;
    const effectiveAspectRatio = `${width} / ${height}`;

    return (
      <div
        className={cn(
          "flex flex-col w-full bg-transparent transition-all group/card gap-4 rounded-2xl",
          isSelectionMode && "cursor-pointer p-4 border-2",
          isSelectionMode && isSelected ? "border-primary/80 bg-emerald-500/5" : (isSelectionMode ? "border-white/5 hover:border-white/10" : "border-0")
        )}
        onClick={(e) => {
          if (isSelectionMode) {
            e.stopPropagation();
            onToggleSelect?.();
          }
        }}
      >
        <div className="flex items-center justify-between gap-4 text-[12px] text-white/30 font-mono  tracking-tight px-1">
          <div className="flex items-center gap-4">
            {config?.isPreset ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary border border-primary/30">
                PRESET: {config.presetName}
              </span>
            ) : (
              <span className="text-white/80">{modelDisplayName}</span>
            )}

            {isWorkflow && (
              <>
                {baseModelDisplayName && (
                  <>
                    <span className="opacity-40">/</span>
                    <span className="text-white/40">Model: {baseModelDisplayName}</span>
                  </>
                )}
                {config?.loras && config.loras.length > 0 && config.loras.map((l, idx) => (
                  <React.Fragment key={idx}>
                    <span className="opacity-40">/</span>
                    <span className="text-white/40">
                      LoRA: {l.model_name.replace('.safetensors', '')} ({l.strength})
                    </span>
                  </React.Fragment>
                ))}
              </>
            )}

            <span className="opacity-40">/</span>
            <span className="text-white/40">{config?.width} x {config?.height}</span>

            {config?.isEdit && (
              <>
                <span className="opacity-40">/</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                  EDIT
                </span>
              </>
            )}

            <span className="opacity-40">/</span>
            <span>{timeStr}</span>

            {result.status === 'pending' && (
              <>
                <span className="opacity-40">/</span>
                <span className="text-primary animate-pulse font-medium">
                  {result.progress ? `${Math.round(result.progress)}%` : 'Generating...'}
                  {result.progressStage ? ` - ${result.progressStage}` : ''}
                </span>
              </>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-2"
          >
            <motion.div className="relative h-full bg-transparent grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-4 items-stretch content-start">
              <motion.div
                className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-black/10 backdrop-blur-md p-4 flex flex-col justify-start"
              >
                <div className="flex items-center justify-between text-[10px] text-white/20 uppercase font-medium mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="block w-1 h-1 rounded-full bg-white/20" />
                    Prompt
                  </div>

                  <TooltipButton
                    icon={<Copy className="w-2 h-2 transition-all duration-300 group-hover/copy:drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]" />}
                    label="Copy Prompt"
                    tooltipContent="Copy Prompt"
                    tooltipSide="top"
                    className="w-3 h-3 bg-transparent hover:bg-transparent text-white/40 hover:text-white transition-all group/copy -mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(prompt);
                      toast({
                        title: "已复制",
                        description: "提示词已复制到剪贴板",
                      });
                    }}
                  />
                </div>
                <motion.div className="flex-1 max-h-[70%] pr-1">
                  <p
                    className="text-[12px] text-white/90 leading-relaxed line-clamp-4 cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyPrompt(prompt);
                      toast({
                        title: "提示词已应用",
                        description: "已将此条提示词填充到输入框",
                      });
                    }}
                  >
                    {prompt}
                  </p>



                  {/* 显示参考图 */}
                  {sourceUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sourceUrls.map((url, idx) => {
                        return (
                          <HistoryReferenceImage
                            key={idx}
                            url={url}
                            idx={idx}
                            resultId={result.id}
                            onRefImageClick={onRefImageClick}
                          />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </motion.div>

              <motion.div className={cn(
                "col-span-4 grid gap-2",
                isWide ? "grid-cols-2" : "grid-cols-4"
              )}>
                {resultsToDisplay.map((res, idx) => {
                  const img = res.outputUrl;
                  return (
                    <div
                      key={res.id || idx}
                      className="relative w-full overflow-hidden rounded-xl group/img border border-white/5 bg-white/5"
                      style={{ aspectRatio: effectiveAspectRatio }}
                    >
                      <AnimatePresence>
                        {res.status === 'pending' ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ exit: { delay: 0.5, duration: 0.3 } }}
                            className="absolute inset-0 z-0 flex items-center justify-center bg-white/5"
                          >
                            <LoadingSpinner size={48} />
                          </motion.div>
                        ) : img ? (
                          <motion.div
                            key="image"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative z-10 w-full h-full"
                          >
                            <Image
                              src={formatImageUrl(img)}
                              alt="Generated image"
                              fill
                              sizes="(max-width: 1536px) 50vw, 800px"
                              className="object-cover cursor-pointer transition-transform duration-500 rounded-xl group-hover/img:scale-[1.05]"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isSelectionMode) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  onImageClick(res, rect);
                                } else {
                                  onToggleSelect?.();
                                }
                              }}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex items-center justify-center text-white/5"
                          >
                            <ImageIcon className="w-8 h-8" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {res.status !== 'pending' && img && !isSelectionMode && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl transition-all duration-300 opacity-0 group-hover/img:opacity-100 group-hover/img:translate-y-0 translate-y-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div>
                                <TooltipButton
                                  icon={<Bookmark className="w-4 h-4" />}
                                  label="Add to Style"
                                  tooltipContent="添加到情绪版"
                                  tooltipSide="top"
                                  className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                                />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-2xl rounded-2xl p-2 min-w-[160px]">
                              <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-wider px-2 py-1">选择风格堆叠</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-white/5" />
                              {styles.length > 0 ? (
                                styles.map(style => (
                                  <DropdownMenuItem
                                    key={style.id}
                                    className="text-white hover:bg-white/10 rounded-xl cursor-pointer"
                                    onClick={() => {
                                      if (img) {
                                        addImageToStyle(style.id, img);
                                        toast({ title: "已添加", description: `已将图片加入风格: ${style.name}` });
                                      }
                                    }}
                                  >
                                    {style.name}
                                  </DropdownMenuItem>
                                ))
                              ) : (
                                <DropdownMenuItem disabled className="text-white/20 text-xs">
                                  暂无可用风格
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                          <TooltipButton
                            icon={<ImageIcon className="w-4 h-4" />}
                            label="Use Image"
                            tooltipContent="Use Image"
                            tooltipSide="top"
                            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                            onClick={() => {
                              applyImage(img);
                              toast({ title: "Image Added", description: "图片已添加为参考图" });
                            }}
                          />

                          <TooltipButton
                            icon={<Pencil className="w-4 h-4" />}
                            label="Edit"
                            tooltipContent="以结果图开始新编辑"
                            tooltipSide="top"
                            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit?.(res, false);
                            }}
                          />

                          <TooltipButton
                            icon={<Download className="w-4 h-4" />}
                            label="Download"
                            tooltipContent="Download"
                            tooltipSide="top"
                            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload(img);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </motion.div>
            <div className="flex gap-2 px-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-sm border-white/10 bg-black/20 text-white/70 hover:bg-black/10 hover:text-white gap-1.5 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(result);
                }}
              >
                <span className="text-md hover:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">Rerun</span>
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-sm border-white/10 bg-black/20 text-white/70 hover:bg-black/10 hover:text-white gap-1.5 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  if (config) {
                    const effectiveModel = config.baseModel || config.model || '';
                    // 1. 回填模型和参数
                    applyModel(effectiveModel, {
                      ...config,
                      prompt: config.prompt,
                      width: config.width,
                      height: config.height,
                      model: config.model,
                      baseModel: config.baseModel,
                      loras: config.loras,
                      presetName: config.presetName,
                      seed: config.seed,
                      aspectRatio: config.aspectRatio,
                      imageSize: config.imageSize,
                      isPreset: config.isPreset,
                    });

                    setSelectedPresetName(config.presetName);

                    // 2. 回填 Prompt
                    applyPrompt(prompt);

                    // 3. 回填参考图（使用 applyImages 处理 local/remote 逻辑，若无图片则清空）
                    const sourceImages = sourceUrls;
                    if (sourceImages.length > 0) {
                      applyImages(sourceImages);
                    } else {
                      // 显式清空当前参考图，实现完全覆盖
                      usePlaygroundStore.getState().setUploadedImages([]);
                    }

                    toast({
                      title: "参数已回填",
                      description: "所有参数已覆盖当前配置",
                    });
                  }
                }}
              >
                <span className="text-[12px] hover:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">Use All</span>
              </Button>

              {config?.isEdit && config?.editConfig && (
                <Button
                  size="sm"
                  className="h-8 rounded-sm border-white/10 bg-black/20 text-primary hover:bg-black/10 hover:text-primary gap-1.5 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(result, true);
                  }}
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span className="text-[12px] hover:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">Edit Again</span>
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden  bg-black/15 rounded-2xl border transition-all duration-300",
        layoutMode === 'grid' && "h-full",
        isSelectionMode && "cursor-pointer border-2",
        isSelectionMode && isSelected ? "border-emerald-500/50 bg-emerald-500/5" : (isSelectionMode ? "border-white/5 hover:border-white/10" : "border-white/10 hover:border-white/30")
      )}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onClick={(e) => {
        if (isSelectionMode) {
          e.stopPropagation();
          onToggleSelect?.();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn("relative z-0 w-full", layoutMode === 'grid' ? "h-full" : "h-auto")}
      >
        <AnimatePresence>
          {result.status === 'pending' ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ exit: { delay: 0.5, duration: 0.3 } }}
              className="absolute inset-0 z-0 flex items-center justify-center bg-white/5"
            >
              <LoadingSpinner size={48} />
            </motion.div>
          ) : mainImage ? (
            <motion.div
              key="image"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 w-full h-full"
            >
              <Image
                src={mainImage}
                alt="Generated image"
                width={result.config?.width || 1024}
                height={result.config?.height || 1024}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                quality={95}
                className={cn(
                  "w-full cursor-pointer scale-100 group-hover:scale-105 transition-transform duration-500",
                  layoutMode === 'grid' ? "h-full object-cover" : "h-auto"
                )}
                onClick={(e) => {
                  if (isSelectionMode) {
                    e.stopPropagation();
                    onToggleSelect?.();
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onImageClick(result, rect);
                  }
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full bg-black/20 flex items-center justify-center"
            />
          )}
        </AnimatePresence>
      </motion.div>

      {!isSelectionMode && (
        <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl transition-all duration-50 ${isHover ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
          <TooltipButton
            icon={<Type className="w-4 h-4" />}
            label="Use Prompt"
            tooltipContent="Use Prompt"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              applyPrompt(result.config?.prompt || '');
            }}
          />
          <TooltipButton
            icon={<ImageIcon className="w-4 h-4" />}
            label="Use Image"
            tooltipContent="Use Image"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              if (mainImage) {
                applyImage(mainImage);
                toast({ title: "Image Added", description: "图片已添加为参考图" });
              }
            }}
          />
          <TooltipButton
            icon={<Box className="w-4 h-4" />}
            label="Use Model"
            tooltipContent="Use Model"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              if (result.config) {
                const effectiveModel = result.config.baseModel || result.config.model;
                applyModel(effectiveModel, {
                  ...result.config,
                  prompt: result.config.prompt,
                  width: result.config.width,
                  height: result.config.height,
                  model: result.config.model,
                  baseModel: result.config.baseModel,
                  loras: result.config.loras,
                  isPreset: result.config.isPreset,
                });
              }
            }}
          />
          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
          <TooltipButton
            icon={<Pencil className="w-4 h-4" />}
            label="Edit"
            tooltipContent="以结果图开始新编辑"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(result, false);
            }}
          />
          <TooltipButton
            icon={<RefreshCw className="w-4 h-4" />}
            label="Remix"
            tooltipContent="Recreate"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate(result);
            }}
          />
          <TooltipButton
            icon={<Download className="w-4 h-4" />}
            label="Download"
            tooltipContent="Download"
            tooltipSide="top"
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              if (mainImage) onDownload(mainImage);
            }}
          />
        </div>
      )}
    </div>
  );
}

function TextHistoryCard({
  result,
  isSelectionMode,
  isSelected,
  onToggleSelect
}: {
  result: Generation;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { toast } = useToast();
  const { applyPrompt } = usePlaygroundStore();
  const prompt = result.config?.prompt || '';

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyPrompt(prompt);
    toast({ title: "提示词已应用", description: "已将描述填充到输入框" });
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-black/5 p-4 flex flex-col justify-start group/card transition-all",
        isSelectionMode && "cursor-pointer",
        isSelectionMode && isSelected ? "border-emerald-500/50 bg-emerald-500/5" : (isSelectionMode ? "border-white/5 hover:border-white/10" : "border-white/10")
      )}
      onClick={(e) => {
        if (isSelectionMode) {
          e.stopPropagation();
          onToggleSelect?.();
        }
      }}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-white/20 uppercase font-medium mb-3">
        <span className="block w-1 h-1 rounded-full bg-white/20" />
        {result.status === 'pending' ? 'Analyzing...' : 'Image Description'}
      </div>

      <div className="flex-1 overflow-hidden">
        {result.status === 'pending' ? (
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSpinner size={20} className="text-white/10" />
          </div>
        ) : (
          <p
            className="text-[11px] text-white/90 leading-relaxed line-clamp-[10] cursor-pointer hover:drop-shadow-[0_0_3px_rgba(255,255,255,0.8)] transition-all"
            onClick={(e) => {
              e.stopPropagation();
              if (!isSelectionMode) {
                applyPrompt(prompt);
                toast({ title: "提示词已应用", description: "已将描述填充到输入框" });
              } else {
                onToggleSelect?.();
              }
            }}
          >
            {prompt}
          </p>
        )}
      </div>

      {result.status !== 'pending' && !isSelectionMode && (
        <div className="flex absolute bottom-3 left-1/2 -translate-x-1/2 gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg border-white/10 bg-white/5 text-primary hover:bg-white/20 hover:border-primary/40 gap-1.5 px-3"
            onClick={handleApply}
          >
            <Type className="w-3 h-3" />
            <span className="text-[10px]">Use Prompt</span>
          </Button>
        </div>
      )}
    </div>
  );
}


