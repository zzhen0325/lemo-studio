import React, { useState } from 'react';

import Image from "next/image";
import { Download, Type, Image as ImageIcon, Box, RefreshCw, Loader2, Copy, Layers, ChevronLeft, ChevronRight, LayoutGrid, List, X, CheckSquare, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Generation } from '@/types/database';
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/common/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { AddToProjectDialog } from "./Dialogs/AddToProjectDialog";
import GradualBlur from "@/components/GradualBlur";

interface HistoryListProps {
  history: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
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

export default function HistoryList({
  history,
  onRegenerate,
  onDownload,
  onImageClick,
  variant = 'default',
  onBatchUse,
  layoutMode = 'list',
  onLayoutModeChange,
  onClose,
}: HistoryListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { setPreviewImage } = usePlaygroundStore();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);

  // Group history by start time (createdAt) and parameters to reflect single-click aggregation
  const groupedHistory = React.useMemo(() => {
    const map = new Map<string, GroupedHistoryItem>();
    history.forEach((result) => {
      const cfg = result.config;
      const isText = !!result.sourceImageUrl && (result.outputUrl === result.sourceImageUrl);
      const type: 'image' | 'text' = isText ? 'text' : 'image';
      const prompt = cfg?.prompt || "";
      const model = cfg?.model || "";
      const width = cfg?.width || 0;
      const height = cfg?.height || 0;
      const lora = cfg?.lora || "";
      const startMs = new Date(result.createdAt).getTime();
      const startBucket = Math.floor(startMs / 60000); // minute-level bucket
      const key = type === 'text'
        ? `text|${startBucket}`
        : `image|${startBucket}|${prompt}|${model}|${width}|${height}|${lora}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(result);
        if (new Date(result.createdAt).getTime() < new Date(existing.startAt).getTime()) {
          existing.startAt = result.createdAt;
        }
      } else {
        map.set(key, {
          type,
          key,
          items: [result],
          sourceImage: type === 'text' ? result.sourceImageUrl : undefined,
          startAt: result.createdAt,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [history]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleGroupSelection = (items: Generation[]) => {
    const newSet = new Set(selectedIds);
    const allSelected = items.every(item => newSet.has(item.id));
    
    if (allSelected) {
      items.forEach(item => newSet.delete(item.id));
    } else {
      items.forEach(item => newSet.add(item.id));
    }
    setSelectedIds(newSet);
  };

  const getSelectedItems = () => {
    return history.filter(item => selectedIds.has(item.id));
  };

  if (history.length === 0) return null;

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-3xl h-full flex flex-col relative overflow-hidden"
    >
      <GradualBlur
        target="parent"
        position="top"
        height="100px"
        strength={3}
        divCount={7}
        curve="bezier"
      
        zIndex={10}
        opacity={1}
        borderRadius="1.5rem"
        animate={{
          type: 'scroll',
          targetRef: scrollRef,
          startOffset: 0,
          endOffset: 80
        }}
      />
      {/* Header Actions: 标题、视图切换 & 关闭 (层级 z-20，确保在模糊 z-10 上方) */}
      <div className="absolute top-6 left-8 z-20 pointer-events-none">

        
        <span className="text-white text-2xl"
          style={{ fontFamily: "'InstrumentSerif', serif" }}
        >History</span>
      </div>

      <div className="absolute top-6 right-8 z-20 flex items-center gap-3">
        <div className="flex items-center p-1 gap-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
           <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedIds(new Set()); // Clear selection on exit
            }}
            className={cn(
              "p-1.5 rounded-md transition-all",
              isSelectionMode
                ? "bg-white/10 text-primary"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title="Select Mode"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
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

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar px-4 ",
          variant === 'default' ? "mt-2" : "mt-4"
        )}
      >
        <div className={cn(
          layoutMode === 'list'
            ? "flex flex-col gap-8 w-full mt-14 mx-auto"
            : "columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 space-y-2 mt-14 w-full mx-auto",
          variant === 'default' ? "max-w-[1500px]" : "max-w-full"
        )}>
          {layoutMode === 'grid' ? (
            history.map((result, idx) => {
              const isText = !!result.sourceImageUrl && (result.outputUrl === result.sourceImageUrl);

              if (isText) {
                return null;
              }

              return (
                <div key={result.id || result.outputUrl || `img-${idx}`} className="break-inside-avoid mb-4">
                  <HistoryCard
                    result={result}
                    onRegenerate={onRegenerate}
                    onDownload={onDownload}
                    onImageClick={onImageClick}
                    onRefImageClick={(url, id) => {
                      setPreviewImage(url, id);
                    }}
                    layoutMode={layoutMode}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(result.id)}
                    onToggleSelect={() => toggleSelection(result.id)}
                  />
                </div>
              );
            })
          ) : (
            groupedHistory.map((group, groupIdx) => {
               const isGroupSelected = group.items.every(item => selectedIds.has(item.id));
               const hasSelection = group.items.some(item => selectedIds.has(item.id));
               
               return (
              <div 
                key={`group-${groupIdx}`} 
                className={cn(
                  "break-inside-avoid flex flex-col overflow-hidden mb-2  transition-all",
                  isSelectionMode ? "cursor-pointer border-2 p-2 rounded-3xl " : "bg-transparent border-0",
                  isSelectionMode && isGroupSelected ? "border-primary/20 bg-white/5" : (isSelectionMode ? "border-transparent hover:bg-white/5" : "")
                )}
                onClick={(e) => {
                  if (isSelectionMode) {
                    // If clicking the container background, toggle group
                    // Prevent if target is inside the card actions
                    toggleGroupSelection(group.items);
                  }
                }}
              >
                {group.type === 'image' ? (
                  <div className="flex flex-col">
                    <HistoryCard
                      result={group.items[0]}
                      allResults={group.items}
                      onRegenerate={onRegenerate}
                      onDownload={onDownload}
                      onImageClick={onImageClick}
                      onRefImageClick={(url, id) => {
                        setPreviewImage(url, id);
                      }}
                      layoutMode={layoutMode}
                      isSelectionMode={isSelectionMode}
                      isSelected={isGroupSelected} // In list mode, the card represents the group
                      onToggleSelect={() => toggleGroupSelection(group.items)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 group/card">
                    <div className="flex items-center justify-between gap-4 text-[10px] text-white/30 font-mono uppercase tracking-tight px-1">
                      <div className="flex items-center gap-4">
                        <span>{new Date(group.startAt).toLocaleString()}</span>
                        <span className="opacity-20">/</span>
                        <span className="text-white/40">Image Analysis</span>
                      </div>
                    </div>

                    <div className="relative bg-transparent grid grid-cols-[1.5fr_4fr] gap-2 items-stretch content-start">
                      <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 group/img">
                        {group.sourceImage ? (
                          <motion.div
                            layoutId={`img-ref-${group.items[0].id}`}
                            className="w-full"
                          >
                            <Image
                              src={group.sourceImage}
                              alt="Source for describe"
                              width={1024}
                              height={1024}
                              className="w-full h-auto cursor-pointer transition-transform duration-500 rounded-xl group-hover/img:scale-[1.05]"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (group.sourceImage) {
                                  setPreviewImage(group.sourceImage, `img-ref-${group.items[0].id}`);
                                }
                              }}
                              unoptimized
                            />
                          </motion.div>
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center text-white/20">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-[4px] text-[10px] text-white/80 font-medium border border-white/10 z-10">
                          Source
                        </div>

                        {onBatchUse && group.items.length > 0 && (
                          <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 rounded-lg bg-black/60 hover:bg-emerald-500 text-white/80 hover:text-white border border-white/10 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBatchUse(group.items, group.sourceImage);
                              }}
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {group.items.map((result, idx) => (
                        <TextHistoryCard 
                          key={result.id || `txt-${idx}`} 
                          result={result}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedIds.has(result.id)}
                          onToggleSelect={() => toggleSelection(result.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )})
          )}

          {/* 独立处理网格模式下的 Describe 项，保持现有的分组聚合交互 */}
          {layoutMode === 'grid' && groupedHistory.filter(g => g.type === 'text').map((group, idx) => (
            <div key={`grid-desc-${idx}`} className="break-inside-avoid mb-4">
              <DescribeInteractiveCard
                group={group}
                onRefImageClick={(url, id) => setPreviewImage(url, id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
              <span className="text-xs font-medium text-white/80 px-2">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddToProjectDialog 
        open={isAddToProjectOpen} 
        onOpenChange={setIsAddToProjectOpen}
        selectedItems={getSelectedItems()}
        onSuccess={() => {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        }}
      />
    </div>

  );
}

function HistoryCard({
  result,
  allResults,
  onRegenerate,
  onDownload,
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
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onRefImageClick: (url: string, id: string) => void;
  layoutMode?: 'grid' | 'list';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [isHover, setIsHover] = React.useState(false);
  const { applyPrompt, applyModel, applyImage } = usePlaygroundStore();
  const { toast } = useToast();
  const mainImage = result.outputUrl;

  const config = result.config;
  const prompt = config?.prompt || '';
  const timeStr = new Date(result.createdAt).toLocaleString();

  if (layoutMode === 'list') {
    const resultsToDisplay = allResults || [result];


    const width = config?.width || 1024;
    const height = config?.height || 1024;
    const isWide = width / height > 1.2;
    // 使用纯粹的图片真实比例，满足“高度跟随图片高度自适应”
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


        {/* Header: Metadata & Actions */}
        <div className="flex items-center justify-between gap-4 text-[12px] text-white/30 font-mono  tracking-tight px-1">

          <div className="flex items-center gap-4">
            {config?.presetName && (
              <>

                <span className="text-white text-md bg-[#b4cdbf4c] px-2 py-0.5 rounded border border-white/10"> {config.presetName}</span>
              </>
            )}
            <span className="opacity-20">/</span>
            <span className="text-white/40">{config?.width} x {config?.height}</span>
            <span className="opacity-20">/</span>
            <span className="text-white/40">{config?.model || 'Unknown'}</span>



            {config?.loras && config.loras.length > 0 && config.loras.map((l, idx) => (
              <React.Fragment key={idx}>
                <span className="opacity-20">/</span>
                <span className="text-white/40  ">
                  LoRA: {l.model_name.replace('.safetensors', '')} ({l.strength})
                </span>
              </React.Fragment>
            ))}
            <span className="opacity-20">/</span>
            <span>{timeStr}</span>
          </div>




        </div>

        {/* Main Layout Grid: Prompt(1) + Images(4) */}
        <AnimatePresence mode="wait">

          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-2"
          >



            <motion.div className="relative h-full bg-transparent grid grid-cols-5 gap-4 items-stretch content-start">
              {/* Prompt slot (fixed to one column) */}
              <motion.div
                className="relative w-full h-full overflow-hidden rounded-xl border border-white/10 bg-black/5 p-4 flex flex-col justify-start"
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
                    className="text-[12px] text-white/90 leading-relaxed line-clamp-6 cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all"
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

                  {result.sourceImageUrl && (
                    <div className="mt-3 group/ref relative w-fit">
                      <motion.div
                        layoutId={`img-ref-${result.id}`}
                        className="relative w-20 aspect-square rounded-lg border border-white/10 overflow-hidden cursor-pointer hover:border-white/30 transition-all shadow-lg"
                        onClick={(e) => {
                           e.stopPropagation();
                           onRefImageClick(result.sourceImageUrl!, `img-ref-${result.id}`)
                        }}
                      >
                        <Image
                          src={result.sourceImageUrl}
                          alt="Reference"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] text-white/70 uppercase font-bold border border-white/5">
                          Ref
                        </div>
                      </motion.div>
                    </div>
                  )}
                </motion.div>

                <div className="absolute w-full bottom-4 left-4 flex  gap-2">
                  <Button
                    variant="ghost"

                    size="sm"
                    className="h-8 rounded-sm border-white/10 bg-black/5 text-white/70 hover:bg-black/10 hover:text-white gap-1.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerate(result);
                    }}
                  >

                    <span className="text-md hover:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">Rerun</span>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-sm border-white/10 bg-black/5 text-white/70 hover:bg-black/10 hover:text-white gap-1.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (config) {
                        applyModel(config.model || '', {
                          prompt: config.prompt,
                          width: config.width,
                          height: config.height,
                          model: config.model,
                          lora: config.lora,
                          loras: config.loras,
                          presetName: config.presetName,
                        });
                        applyPrompt(prompt);

                        // Backfill reference image if available
                        if (result.sourceImageUrl) {
                          applyImage(result.sourceImageUrl);
                        }

                        toast({
                          title: "参数已回填",
                          description: "生成参数已应用到当前配置",
                        });
                      }
                    }}
                  >

                    <span className="text-[12px] hover:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">Use All</span>
                  </Button>
                </div>
              </motion.div>

              {/* Images Section (takes 4 columns) */}
              <motion.div className={cn(
                "col-span-4 grid gap-4",
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
                      {res.status === 'pending' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-white/10" />
                        </div>
                      ) : img ? (
                        <Image
                          src={img}
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
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/5">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      {/* Individual Actions Overlay */}
                      {res.status !== 'pending' && img && !isSelectionMode && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <TooltipButton
                            icon={<Download className="w-3.5 h-3.5" />}
                            label="Download"
                            tooltipContent="Download"
                            className="w-7 h-7 bg-black/60 rounded-lg"
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
          </motion.div>
        </AnimatePresence>
      </div>

    );
  }



  // grid模式


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
        {result.status === 'pending' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/20">
            <Loader2 className="w-8 h-8 animate-spin text-white/20" />
          </div>
        ) : mainImage ? (
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
        ) : (
          <div className="w-full h-full bg-black/20 flex items-center justify-center" />
        )}
      </motion.div>

      {!isSelectionMode && (
      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl transition-all duration-50 ${isHover ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        <TooltipButton
          icon={<Type className="w-4 h-4" />}
          label="Use Prompt"
          tooltipContent="Use Prompt"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => applyPrompt(result.config?.prompt || '')}
        />
        <TooltipButton
          icon={<ImageIcon className="w-4 h-4" />}
          label="Use Image"
          tooltipContent="Use Image"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => mainImage && applyImage(mainImage)}
        />
        <TooltipButton
          icon={<Box className="w-4 h-4" />}
          label="Use Model"
          tooltipContent="Use Model"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => result.config && applyModel(result.config.model, {
            prompt: result.config.prompt,
            width: result.config.width,
            height: result.config.height,
            model: result.config.model,
            lora: result.config.lora,
            loras: result.config.loras,
          })}
        />
        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
        <TooltipButton
          icon={<RefreshCw className="w-4 h-4" />}
          label="Remix"
          tooltipContent="Recreate"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          onClick={() => onRegenerate(result)}
        />
        <TooltipButton
          icon={<Download className="w-4 h-4" />}
          label="Download"
          tooltipContent="Download"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => mainImage && onDownload(mainImage)}
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
            <Loader2 className="w-5 h-5 animate-spin text-white/10" />
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
        <>
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
        </>
      )}
    </div>
  );
}

function DescribeInteractiveCard({
  group,
  onRefImageClick,
}: {
  group: GroupedHistoryItem;
  onRefImageClick: (url: string, id: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const currentItem = group.items[currentIndex];
  const prompt = currentItem?.config?.prompt || '';
  const { toast } = useToast();
  const { applyPrompt } = usePlaygroundStore();

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyPrompt(prompt);
    toast({ title: "提示词已应用", description: "已将描述填充到输入框" });
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % group.items.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + group.items.length) % group.items.length);
  };

  return (
    <div className="group relative w-full overflow-hidden bg-black/15 rounded-2xl border border-white/10 transition-all duration-300 hover:border-white/30 aspect-square">
      {/* Base Image */}
      {group.sourceImage ? (
        <motion.div
          layoutId={`img-ref-${currentItem.id}`}
          className="w-full h-full"
        >
          <Image
            src={group.sourceImage}
            alt="Source"
            fill
            className="object-cover"
            onClick={() => {
              if (group.sourceImage) {
                onRefImageClick(group.sourceImage, `img-ref-${currentItem.id}`);
              }
            }}
          />
        </motion.div>
      ) : (
        <div className="w-full h-full bg-black/40 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-white/20" />
        </div>
      )}

      {/* Overlay Description */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col p-6 justify-center items-center text-center">
        <div className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center w-full px-4">
          <p className="text-[11px] text-white/90 leading-relaxed line-clamp-[8]">
            {prompt}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-white/10 bg-white/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 gap-1.5 px-3"
            onClick={handleApply}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="text-[10px]">Use Prompt</span>
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {group.items.length > 1 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <button
            onClick={prev}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all pointer-events-auto"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all pointer-events-auto"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pagination dots */}
      {group.items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/30 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-white/5">
          {group.items.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                currentIndex === idx ? "bg-emerald-400 w-3" : "bg-white/20 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-[4px] text-[10px] text-white/80 font-medium border border-white/10 z-10">
        Analysis
      </div>

    </div>
  );
}
