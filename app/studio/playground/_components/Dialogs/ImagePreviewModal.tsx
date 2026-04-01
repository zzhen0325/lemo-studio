import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Pencil, Info, Copy, Download, ChevronLeft, ChevronRight, Layers, Type, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipButton } from "@/components/ui/tooltip-button";
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Generation } from '@/types/database';
import { useToast } from '@/hooks/common/use-toast';

import { resolveGalleryImageUrl } from '@/lib/gallery-asset';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useImageSource } from '@/hooks/common/use-image-source';
import { downloadImage } from '@/lib/utils/download';
import { usePlaygroundAvailableModels } from '@studio/playground/_components/hooks/useGenerationService';
import { AddToMoodboardMenu } from '@studio/playground/_components/AddToMoodboardMenu';
import { InteractionButtons, InteractionStatsDisplay } from '@studio/playground/_components/InteractionButtons';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: Generation;
  results?: Generation[];
  currentIndex?: number;
  isLoadingDetails?: boolean;
  onSelectResult?: (result: Generation) => void;
  onEdit?: (result: Generation) => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onRegenerate?: (result: Generation) => void;
  onApplyPrompt?: (result: Generation) => void;
  onApplyImage?: (result: Generation) => void | Promise<void>;
}

function getResultIdentity(result?: Generation) {
  if (!result) return '';
  return result.id?.trim() || result.outputUrl?.trim() || result.createdAt?.trim() || '';
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  result,
  results = [],
  currentIndex = -1,
  isLoadingDetails = false,
  onSelectResult,
  onEdit,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onRegenerate,
  onApplyPrompt,
  onApplyImage,
}: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const { toast } = useToast();
  const applyModel = usePlaygroundStore((state) => state.applyModel);
  const applyImages = usePlaygroundStore((state) => state.applyImages);
  const applyPrompt = usePlaygroundStore((state) => state.applyPrompt);
  const applyImage = usePlaygroundStore((state) => state.applyImage);
  const ensureSession = useAuthStore((state) => state.ensureSession);
  const [mounted, setMounted] = useState(false);
  const availableModels = usePlaygroundAvailableModels();

  // 本地状态用于即时更新交互数据
  const [localInteractionStats, setLocalInteractionStats] = useState(result?.interactionStats);
  const [localViewerState, setLocalViewerState] = useState(result?.viewerState);

  // 数据已规范化，直接从 config.sourceImageUrls 读取
  const sourceUrls = result?.config?.sourceImageUrls || [];
  const activeResultIdentity = getResultIdentity(result);
  const previewResults = results.filter((item) => Boolean(item.outputUrl?.trim()));


  useEffect(() => {
    setMounted(true);
    void ensureSession().catch(() => undefined);
  }, [ensureSession]);

  // 当 result 变化时，重置本地交互数据状态
  useEffect(() => {
    setLocalInteractionStats(result?.interactionStats);
    setLocalViewerState(result?.viewerState);
  }, [result?.id, result?.interactionStats, result?.viewerState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
    }
  }, [isOpen]);

  if (!result) return null;

  // Modal always uses the original output URL to keep preview quality high.
  const fullResImageUrl = resolveGalleryImageUrl(result.outputUrl || "");
  const config = result.config;
  const prompt = config?.prompt || "";
  const modelDisplayName = availableModels.find((model) => model.id === config?.model)?.displayName || config?.model || "Standard";

  const handleZoomIn = () => { setScale(prev => Math.min(prev * 1.2, 5)); };
  const handleZoomOut = () => { setScale(prev => Math.max(prev / 1.2, 0.1)); };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleBackgroundClick = () => {
    onClose();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    toast({ title: "已复制", description: "提示词已复制到剪贴板" });
  };

  const handleRerun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate && result) {
      onRegenerate(result);
      toast({ title: "重运行中", description: "已开始重新生成" });
      onClose(); // Optional: close modal when rerunning? Maybe better to stay open or close depending on UX. HistoryList logic doesn't seemingly close? GalleryView switches tab.
      // Replicating GalleryView behavior: switch to dock (not applicable here directly but closing modal seems right if we move to generating state). 
      // User didn't specify, but closing is safer to show progress.
      // Actually, if I close, the user sees the generation in progress in the list.
    }
  };

  const handleUseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config) return;

    // Logic from HistoryList
    applyModel(config.model, {
      ...config,
      loras: config.loras || [],
      presetName: config.presetName,
    });

    // Sync reference images to uploadedImages for preview
    const validSourceUrls = config.sourceImageUrls?.filter(url => !!url) || [];
    if (validSourceUrls.length > 0) {
      applyImages(validSourceUrls);
    }

    toast({ title: "已应用配置", description: "所有参数已应用到当前工作流" });
    onClose(); // Close modal to show the updated playground
  };

  const handleDownload = () => {
    if (fullResImageUrl) {
      downloadImage(fullResImageUrl, `image-${result.id || Date.now()}.png`);
    }
  };

  const handleApplyPrompt = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!prompt) return;
    if (onApplyPrompt) {
      onApplyPrompt(result);
      return;
    }
    applyPrompt(prompt);
    toast({ title: "Prompt Applied", description: "提示词已应用到输入框" });
  };

  const handleApplyImage = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!result.outputUrl) return;
    if (onApplyImage) {
      await onApplyImage(result);
    } else {
      await applyImage(result.outputUrl);
    }
    toast({ title: "Image Added", description: "图片已添加为参考图" });
  };

  // 处理点赞后更新交互数据
  const handleInteractionUpdate = (stats: typeof localInteractionStats, state: typeof localViewerState) => {
    setLocalInteractionStats(stats);
    setLocalViewerState(state);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-layer-lightbox flex overflow-hidden pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            onClick={handleBackgroundClick}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* Main Content Area */}
          {/* Main Content Area */}
          <div className="relative flex flex-1 h-full overflow-hidden">

            {/* Image Viewport - Container for scaling image and fixed control bar */}
            <div
              className="relative flex-1 h-full flex flex-col items-center justify-center overflow-auto p-12 transition-all duration-300"
              onWheel={handleWheel}
              onClick={handleBackgroundClick}
            >
              {/* Scalable Image Container */}
              <motion.div
                layoutId={`image-${result.id}`}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ scale: scale }}
                className="relative shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={fullResImageUrl}
                  alt="Preview"
                  width={1200}
                  height={1200}
                  unoptimized
                  className="max-w-[95%] select-none w-auto h-auto max-h-[75vh] rounded-2xl shadow-2xl border border-white/10"
                  style={{ pointerEvents: 'auto' }}
                  draggable={false}
                />
              </motion.div>

              {/* Navigation Buttons */}
              <AnimatePresence>
                {hasPrev && (
                  <motion.div
                    key="preview-nav-prev"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute left-10 top-1/2 z-20 -translate-y-1/2"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-14 h-14 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white transition-all shadow-2xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrev?.();
                      }}
                    >
                      <ChevronLeft className="w-8 h-8" />
                    </Button>
                  </motion.div>
                )}
                {hasNext && (
                  <motion.div
                    key="preview-nav-next"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute right-10 top-1/2 z-20 -translate-y-1/2"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-14 h-14 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white transition-all shadow-2xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNext?.();
                      }}
                    >
                      <ChevronRight className="w-8 h-8" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fixed Control Bar - sibling to scaled image */}
              <div className='flex justify-center w-full mt-10 shrink-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.2 }}
                  className="flex w-fit items-center gap-1 p-1.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Like Button */}
                  <InteractionButtons
                    generationId={result.id}
                    interactionStats={localInteractionStats}
                    viewerState={localViewerState}
                    onInteractionUpdate={handleInteractionUpdate}
                  />

                  <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                  {result.outputUrl && (
                    <AddToMoodboardMenu
                      imagePath={result.outputUrl}
                      className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                    />
                  )}

                  <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                  <TooltipButton
                    icon={<Type className="w-4 h-4" />}
                    label="Use Prompt"
                    tooltipContent="Use Prompt"
                    tooltipSide="top"
                    className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                    onClick={handleApplyPrompt}
                  />

                  <TooltipButton
                    icon={<ImageIcon className="w-4 h-4" />}
                    label="Use Image"
                    tooltipContent="Use Image"
                    tooltipSide="top"
                    className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                    onClick={handleApplyImage}
                  />

                  <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                  {onRegenerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors gap-2"
                      onClick={handleRerun}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Rerun</span>
                    </Button>
                  )}

                  <TooltipButton
                    icon={<Download className="w-4 h-4" />}
                    label="Download"
                    tooltipContent="Download"
                    tooltipSide="top"
                    className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors gap-2"
                    onClick={handleUseAll}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Use All</span>
                  </Button>
                  {onEdit && (
                    <Button
                      variant="act"
                      size="sm"
                      className="h-8 px-4 rounded-xl transition-all font-medium gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(result);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  )}
                </motion.div>
              </div>

              {/* Reference Image Thumbnails - absolute to Viewport */}
              {sourceUrls.length > 0 && (
                <div className="absolute left-6 top-10 z-20 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                  {sourceUrls.filter(url => !!url).map((url, idx) => {
                    const localId = result.config?.localSourceIds?.[idx];
                    // 使用更加唯一的 ID 组合，结合 localId 或 idx 来保证唯一性
                    const itemKey = localId ? `ref-${result.id}-${localId}` : `ref-${result.id}-${idx}-${url.slice(-8)}`;
                    return (
                      <ReferenceImageItem
                        key={itemKey}
                        url={url}
                        localId={localId}
                        generationId={result.id}
                        index={idx}
                      />
                    );
                  })}
                </div>
              )}

              {/* Sidebar toggle */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute right-4 top-4 z-20 p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <Info className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Sidebar */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 24, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 h-full w-[20vw] shrink-0 overflow-hidden border-l border-white/10 bg-black/60 backdrop-blur-2xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h3 className="font-serif text-lg text-white">Details</h3>
                    <div className="flex items-center gap-2">
                      {isLoadingDetails && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-white/40 font-mono uppercase tracking-widest">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Syncing
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full text-white/40 hover:text-white hover:bg-white/10"
                        onClick={onClose}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Prompt</span>
                          <button
                            onClick={handleCopyPrompt}
                            className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <p className="text-white/80 text-sm leading-relaxed break-words">
                            {prompt || "No prompt available"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Model</span>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                            {modelDisplayName}
                          </span>
                          {config?.loras?.map((l, idx) => {
                            const loraKey = `lora-${result.id}-${l.model_name}-${idx}`;
                            return (
                              <span key={loraKey} className="px-3 py-1.5 bg-white/5 text-white/60 text-xs font-medium rounded-full border border-white/10 truncate max-w-full">
                                {l.model_name.replace('.safetensors', '')} ({l.strength})
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Parameters</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] text-white/30 uppercase font-mono">Width</span>
                            <span className="text-white text-sm font-medium tabular-nums">{config?.width || '-'}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] text-white/30 uppercase font-mono">Height</span>
                            <span className="text-white text-sm font-medium tabular-nums">{config?.height || '-'}</span>
                          </div>
                        </div>
                      </div>

                      {config?.presetName && (
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Preset</span>
                          <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-white/80 text-sm">{config.presetName}</span>
                          </div>
                        </div>
                      )}

                      {result.createdAt && (
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Created</span>
                          <div className="text-white/50 text-xs font-mono">
                            {new Date(result.createdAt).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {/* Interactions Stats */}
                      <InteractionStatsDisplay interactionStats={localInteractionStats} />
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>

            {previewResults.length > 1 && (
              <motion.aside
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative z-10 h-full w-20 shrink-0 overflow-hidden border-l border-white/10 bg-black/40 backdrop-blur-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto py-4 border-none items-center justify-center shrink-0">
                  {/* <div className="text-[10px] text-white/30 uppercase font-mono tracking-[0.24em]">Images</div> */}
                  <div className=" text-sm items-center justify-center text-white/80 tabular-nums">
                    {currentIndex >= 0 ? `${currentIndex + 1} / ${previewResults.length}` : `${previewResults.length}`}
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-3 pt-2 space-y-3">
                    {previewResults.map((item, index) => (
                      <PreviewResultThumbnail
                        key={`preview-result-${getResultIdentity(item)}-${index}`}
                        result={item}
                        index={index}
                        isActive={getResultIdentity(item) === activeResultIdentity}
                        onSelect={onSelectResult}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </motion.aside>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function PreviewResultThumbnail({
  result,
  index,
  isActive,
  onSelect
}: {
  result: Generation;
  index: number;
  isActive: boolean;
  onSelect?: (result: Generation) => void;
}) {
  const imageUrl = resolveGalleryImageUrl(result.outputUrl || '');

  return (
    <button
      type="button"
      className={`group/result block w-full text-left transition-transform ${isActive ? 'scale-[1.01]' : 'hover:scale-[1.02]'}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(result);
      }}
    >
      <div
        className={`relative aspect-square overflow-hidden rounded-2xl border  transition-all ${
          isActive
            ? 'border-white/70 ring-2 ring-white/30'
            : 'border-white/10 hover:border-white/30'
        }`}
      >
        <Image
          src={imageUrl}
          alt={`Result ${index + 1}`}
          fill
          sizes="96px"
          className="object-cover"
          unoptimized
        />
        <div className={`absolute inset-0 transition-colors ${isActive ? 'bg-transparent' : 'bg-black/15 group-hover/result:bg-black/0'}`} />
        {/* <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[10px] font-mono text-white/90 shadow-lg">
          {index + 1}
        </div> */}
      </div>
    </button>
  );
}

function ReferenceImageItem({
  url,
  localId,
  generationId,
  index
}: {
  url: string;
  localId?: string;
  generationId: string;
  index: number;
}) {
  const setPreviewImage = usePlaygroundStore(s => s.setPreviewImage);
  const sourceImage = useImageSource(url, localId);
  const displayUrl = sourceImage || resolveGalleryImageUrl(url);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      className="group/ref relative flex flex-col items-center"
    >
      <div
        className="w-20 h-20 rounded-xl border-2 border-white overflow-hidden shadow-2xl cursor-zoom-in relative"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewImage(displayUrl || null, `ref-${generationId}-${index}`);
        }}
      >
        <Image
          src={displayUrl}
          alt={`Reference ${index + 1}`}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/20 group-hover/ref:bg-transparent transition-colors flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/ref:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="mt-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[9px] text-white/90 uppercase font-bold tracking-tight text-center shadow-lg">
        Ref {index + 1}
      </div>
    </motion.div>
  );
}
