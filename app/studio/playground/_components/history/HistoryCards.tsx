import React from 'react';
import Image from 'next/image';
import {
  Download,
  Type,
  Image as ImageIcon,
  Box,
  RefreshCw,
  Copy,
  GripVertical,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Generation } from '@/types/database';
import { usePlaygroundAvailableModels } from '@studio/playground/_components/hooks/useGenerationService';
import { TooltipButton } from '@/components/ui/tooltip-button';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useImageSource } from '@/hooks/common/use-image-source';
import { cn } from '@/lib/utils';
import { formatImageUrl } from '@/lib/api-base';
import { useToast } from '@/hooks/common/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isWorkflowModel } from '@/lib/utils/model-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useDraggable } from '@dnd-kit/core';
import { AddToMoodboardMenu } from '@studio/playground/_components/AddToMoodboardMenu';
import { buildHistoryTags, isHistoryEditGeneration } from '@/app/studio/playground/_lib/history-tags';

function resolveHistoryModelDisplayName(
  config: Generation['config'],
  availableModels: Array<{ id: string; displayName: string }>,
): string {
  const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const modelId = trim(config?.model);
  const baseModelId = trim(config?.baseModel);
  const workflowName = trim(config?.workflowName);

  if (modelId) {
    const matchedModel = availableModels.find((model) => model.id === modelId);
    if (matchedModel?.displayName) {
      return matchedModel.displayName;
    }

    if (isWorkflowModel(modelId) && workflowName) {
      return workflowName;
    }

    if (baseModelId) {
      const matchedBaseModel = availableModels.find((model) => model.id === baseModelId);
      return matchedBaseModel?.displayName || baseModelId;
    }

    return modelId;
  }

  if (baseModelId) {
    const matchedBaseModel = availableModels.find((model) => model.id === baseModelId);
    return matchedBaseModel?.displayName || baseModelId;
  }

  if (workflowName) {
    return workflowName;
  }

  return 'Unknown';
}

export function DescribeSourceImage({
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
      className="w-full h-full"
    >
      <Image
        src={src}
        alt="Source for describe"
        width={1024}
        height={1024}
        className="w-full h-full object-cover cursor-pointer transition-transform duration-500 rounded-xl group-hover/img:scale-[1.05]"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(src, `img-ref-${generationId}`);
        }}
        unoptimized
      />
    </motion.div>
  );
}

export function HistoryReferenceImage({
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

export function DraggableHistoryCard({
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

export const HistoryCard = React.memo(function HistoryCard({
  result,
  allResults,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  onRefImageClick,
  onUsePrompt,
  onUseAll,
  onUseModel,
  layoutMode = 'list',
  isSelectionMode,
  isSelected,
  onToggleSelect,
  moodboards,
  moodboardCards,
  refreshMoodboardCards,
}: {
  result: Generation;
  allResults?: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (result: Generation, imageUrl: string) => void;
  onEdit?: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onRefImageClick: (url: string, id: string) => void;
  onUsePrompt?: (result: Generation) => void;
  onUseAll?: (result: Generation) => void | Promise<void>;
  onUseModel?: (result: Generation) => void | Promise<void>;
  layoutMode?: 'grid' | 'list';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  moodboards?: import('@/types/database').StyleStack[];
  moodboardCards?: import('@/config/moodboard-cards').MoodboardCard[];
  refreshMoodboardCards?: () => Promise<void>;
}) {
  const [isHover, setIsHover] = React.useState(false);
  const [hoveredResultId, setHoveredResultId] = React.useState<string | null>(null);
  const availableModels = usePlaygroundAvailableModels();
  const applyPrompt = usePlaygroundStore((state) => state.applyPrompt);
  const applyModel = usePlaygroundStore((state) => state.applyModel);
  const applyImage = usePlaygroundStore((state) => state.applyImage);
  const applyImages = usePlaygroundStore((state) => state.applyImages);
  const setSelectedPresetName = usePlaygroundStore((state) => state.setSelectedPresetName);
  const { toast } = useToast();

  // 数据已规范化，直接从 config.sourceImageUrls 读取
  const sourceUrls = React.useMemo<string[]>(() => {
    return result.config?.sourceImageUrls || [];
  }, [result.config?.sourceImageUrls]);

  const mainImage = formatImageUrl(result.outputUrl);

  const config = result.config;
  const isWorkflow = isWorkflowModel(config?.model);
  const historyTags = React.useMemo(() => buildHistoryTags(config), [config]);
  const isEditHistory = isHistoryEditGeneration(config);
  const modelDisplayName = React.useMemo(
    () => resolveHistoryModelDisplayName(config, availableModels),
    [availableModels, config],
  );
  const baseModelDisplayName = config?.baseModel ? (availableModels.find(m => m.id === config.baseModel)?.displayName || config.baseModel) : undefined;
  const prompt = config?.prompt || '';
  const timeStr = new Date(result.createdAt).toLocaleString();
  const applyPromptFromHistoryItem = React.useCallback((target: Generation) => {
    if (onUsePrompt) {
      onUsePrompt(target);
      return;
    }

    applyPrompt(target.config?.prompt || '');
  }, [applyPrompt, onUsePrompt]);

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
            <span className="text-white/80">{modelDisplayName}</span>

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

            {historyTags.map((tag) => (
              <React.Fragment key={`${result.id}-${tag.kind}-${tag.label}`}>
                <span className="opacity-40">/</span>
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary border border-primary/30",
                    tag.kind === 'edit' ? "font-bold" : "font-medium",
                  )}
                >
                  {tag.label}
                </span>
              </React.Fragment>
            ))}

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

            {result.status !== 'pending' && result.clientSyncState === 'syncing' && (
              <>
                <span className="opacity-40">/</span>
                <span className="text-amber-300/80 font-medium">Syncing...</span>
              </>
            )}

            {result.clientSyncState === 'persist_failed' && (
              <>
                <span className="opacity-40">/</span>
                <span className="text-red-400 font-medium">Save failed</span>
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
                className="relative w-full h-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#1079BB]/10  to-white/5 p-4 flex flex-col justify-start"
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
                    withProvider={false}
                    className="w-2 h-2 p-1 bg-transparent hover:bg-transparent text-white/20 hover:text-white transition-all group/copy "
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
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p
                          className="text-[12px] text-white/90 leading-relaxed line-clamp-4 cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyPromptFromHistoryItem(result);
                            toast({
                              title: "提示词已应用",
                              description: "已将此条提示词填充到输入框",
                            });
                          }}
                        >
                          {prompt}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-[560px] max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed"
                      >
                        {prompt}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>



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
                  const displayImg = img ? formatImageUrl(img) : '';
                  const isExternalDisplayImg = /^https?:\/\//i.test(displayImg);
                  return (
                    <div
                      key={res.id || idx}
                      className="relative w-full overflow-hidden rounded-xl group/img border border-white/5 bg-white/5"
                      style={{ aspectRatio: effectiveAspectRatio }}
                      onMouseEnter={() => setHoveredResultId(res.id)}
                      onMouseLeave={() => setHoveredResultId((current) => (current === res.id ? null : current))}
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
                            <LoadingSpinner size={20} />
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
                              src={displayImg}
                              alt="Generated image"
                              fill
                              sizes="(max-width: 1536px) 50vw, 800px"
                              unoptimized={isExternalDisplayImg}
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
                      {res.status !== 'pending' && img && !isSelectionMode && hoveredResultId === res.id ? (
                        <div
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl transition-all duration-300 opacity-100 translate-y-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AddToMoodboardMenu
                            imagePath={img}
                            tooltipWithProvider={false}
                            moodboardsData={moodboards}
                            moodboardCardsData={moodboardCards}
                            onRefreshMoodboardCards={refreshMoodboardCards}
                          />

                          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                          <TooltipButton
                            icon={<ImageIcon className="w-4 h-4" />}
                            label="Use Image"
                            tooltipContent="Use Image"
                            tooltipSide="top"
                            withProvider={false}
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
                            withProvider={false}
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
                            withProvider={false}
                            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload(res, img);
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </motion.div>
            </motion.div>
            <div className="flex gap-2 px-1 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-sm border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(result);
                }}
              >
                <span className="text-md hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">Rerun</span>
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-sm border  border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditHistory) {
                    onEdit?.(result, true);
                    return;
                  }

                  if (onUseAll) {
                    void onUseAll(result);
                    return;
                  }

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
                    applyPromptFromHistoryItem(result);

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
                <span className="text-[12px] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                  {isEditHistory ? 'Edit Again' : 'Use All'}
                </span>
              </Button>
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
              <LoadingSpinner size={36} />
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
                unoptimized={/^https?:\/\//i.test(mainImage)}
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

              {/* Batch count badge for grouped images */}
              {allResults && allResults.length > 1 && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 text-[10px] text-white/90 font-mono z-20 flex items-center gap-1 shadow-lg">
                  <Box className="w-2.5 h-2.5" />
                  {allResults.length}
                </div>
              )}

              {result.clientSyncState === 'syncing' && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-amber-400/20 text-[10px] text-amber-200 font-mono z-20 shadow-lg">
                  Syncing
                </div>
              )}

              {result.clientSyncState === 'persist_failed' && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded-md border border-red-400/30 text-[10px] text-red-300 font-mono z-20 shadow-lg">
                  Save failed
                </div>
              )}
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

      {!isSelectionMode && isHover ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl transition-all duration-50 opacity-100 translate-y-0 scale-100" onClick={(e) => e.stopPropagation()}>
          <TooltipButton
            icon={<Type className="w-4 h-4" />}
            label="Use Prompt"
            tooltipContent="Use Prompt"
            tooltipSide="top"
            withProvider={false}
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              applyPromptFromHistoryItem(result);
            }}
          />
          <TooltipButton
            icon={<ImageIcon className="w-4 h-4" />}
            label="Use Image"
            tooltipContent="Use Image"
            tooltipSide="top"
            withProvider={false}
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
            withProvider={false}
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              if (onUseModel) {
                void onUseModel(result);
                return;
              }
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
            withProvider={false}
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
            withProvider={false}
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
            withProvider={false}
            className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              if (mainImage) onDownload(result, mainImage);
            }}
          />
        </div>
      ) : null}
    </div>
  );
});

export const TextHistoryCard = React.memo(function TextHistoryCard({
  result,
  title = 'Image Description',
  actionLabel = 'Use Prompt',
  onUsePrompt,
  isSelectionMode,
  isSelected,
  onToggleSelect
}: {
  result: Generation;
  title?: string;
  actionLabel?: string;
  onUsePrompt?: (result: Generation) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { toast } = useToast();
  const applyPrompt = usePlaygroundStore((state) => state.applyPrompt);
  const prompt = result.config?.prompt || '';

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUsePrompt) {
      onUsePrompt(result);
    } else {
      applyPrompt(prompt);
    }
    toast({ title: "提示词已应用", description: "已将内容填充到输入框" });
  };

  return (
    <div
      className={cn(
        "relative w-full h-[220px] overflow-hidden rounded-xl border bg-black/5 p-4 flex flex-col justify-start group/card transition-all",
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
        {result.status === 'pending' ? 'Thinking...' : title}
      </div>

      {result.status !== 'pending' && result.clientSyncState === 'syncing' && (
        <div className="mb-3 text-[10px] uppercase font-medium text-amber-300/80">
          Syncing...
        </div>
      )}

      {result.clientSyncState === 'persist_failed' && (
        <div className="mb-3 text-[10px] uppercase font-medium text-red-400">
          Save failed
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {result.status === 'pending' ? (
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSpinner size={20} className="text-white/10" />
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto pr-1 custom-scrollbar">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p
                    className="text-[11px] text-white/90 leading-relaxed cursor-pointer hover:drop-shadow-[0_0_3px_rgba(255,255,255,0.8)] transition-all whitespace-pre-wrap break-words"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelectionMode) {
                        if (onUsePrompt) {
                          onUsePrompt(result);
                        } else {
                          applyPrompt(prompt);
                        }
                        toast({ title: "提示词已应用", description: "已将内容填充到输入框" });
                      } else {
                        onToggleSelect?.();
                      }
                    }}
                  >
                    {prompt}
                  </p>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-[560px] max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed"
                >
                  {prompt}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {result.status !== 'pending' && !isSelectionMode && (
        <div className="flex absolute bottom-3 left-1/2 -translate-x-1/2 gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg border-white/10 bg-white/15 backdrop-blur-md text-white  hover:bg-white/20 hover:border-primary/40 gap-1.5 px-3"
            onClick={handleApply}
          >
            <Type className="w-3 h-3" />
            <span className="text-[10px]">{actionLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
});

HistoryCard.displayName = 'HistoryCard';
TextHistoryCard.displayName = 'TextHistoryCard';
