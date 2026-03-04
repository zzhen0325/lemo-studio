"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  GalleryHorizontalEnd,
  Loader2,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { InfiniteCanvasNode } from '@/types/infinite-canvas';
import {
  DEFAULT_INFINITE_CANVAS_MODEL_ID,
  INFINITE_ASPECT_RATIOS,
  INFINITE_BATCH_SIZES,
  INFINITE_CANVAS_MODELS,
  INFINITE_IMAGE_SIZES,
} from '../_lib/constants';
import { useAPIConfigStore } from '@/lib/store/api-config-store';
import { getContextModelOptions } from '@/lib/model-center-ui';
import { normalizeImageSizeToken } from '@/lib/model-center';

const STATUS_COLOR: Record<InfiniteCanvasNode['status'], string> = {
  idle: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-slate-500/30 dark:text-slate-200 dark:border-slate-400/30',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-300/30',
  running: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-300/40',
  success: 'bg-zinc-900 text-[#C8F88D] border-zinc-800 dark:bg-[#C8F88D]/20 dark:text-[#C8F88D] dark:border-[#C8F88D]/40',
  error: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-300/40',
  locked: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-300/40',
};

interface CanvasNodeCardProps {
  node: InfiniteCanvasNode;
  selected: boolean;
  isConnectionSource: boolean;
  isConnectionTarget: boolean;
  onSelect: (nodeId: string, additive: boolean) => void;
  onDragStart: (nodeId: string, clientX: number, clientY: number) => void;
  onPromptChange: (nodeId: string, value: string) => void;
  onTitleChange: (nodeId: string, value: string) => void;
  onImageModelChange: (nodeId: string, modelId: string) => void;
  onImageParamsChange: (
    nodeId: string,
    params: Partial<NonNullable<InfiniteCanvasNode['params']>>,
  ) => void;
  onRun: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onEditImage?: (nodeId: string) => void;
  onInputPortClick: (nodeId: string) => void;
  onOutputPortClick: (nodeId: string) => void;
  onGalleryImagesChange: (nodeId: string, images: string[]) => void;
  onResize: (nodeId: string, width: number, height: number) => void;
  onUploadImage?: (nodeId: string, file: File) => void;
  onOptimizePrompt?: (nodeId: string) => void;
  isOptimizing?: boolean;
}

function formatEta(seconds?: number) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

// ──────────────────────────────────────────────
// Gallery 节点子组件
// ──────────────────────────────────────────────
interface GalleryNodeCardProps {
  node: InfiniteCanvasNode;
  onGalleryImagesChange: (nodeId: string, images: string[]) => void;
}

function GalleryNodeCard({ node, onGalleryImagesChange }: GalleryNodeCardProps) {
  const images = useMemo(() => node.galleryImages ?? [], [node.galleryImages]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);

  // ── 内部图片拖拽排序 ──
  const handleItemDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.stopPropagation();
      dragIndexRef.current = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/gallery-item-index', String(index));
    },
    [],
  );

  const handleItemDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      // 仅接受来自内部的图片格
      if (!event.dataTransfer.types.includes('application/gallery-item-index') &&
        !event.dataTransfer.types.includes('application/canvas-node-image-url')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [],
  );

  const handleItemDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      setDragOverIndex(null);

      // 接受外部画布节点的图片
      const externalUrl = event.dataTransfer.getData('application/canvas-node-image-url');
      if (externalUrl) {
        const next = [...images];
        next.splice(dropIndex, 0, externalUrl);
        onGalleryImagesChange(node.nodeId, next);
        return;
      }

      // 内部重排
      const fromIndex = dragIndexRef.current;
      if (fromIndex === null || fromIndex === dropIndex) {
        dragIndexRef.current = null;
        return;
      }
      const next = [...images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(dropIndex, 0, moved);
      dragIndexRef.current = null;
      onGalleryImagesChange(node.nodeId, next);
    },
    [images, node.nodeId, onGalleryImagesChange],
  );

  const handleItemDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  // ── 整体容器 drop（添加到末尾）──
  const handleContainerDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('application/canvas-node-image-url')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropTargetActive(true);
  }, []);

  const handleContainerDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    // 只有离开整个容器时才取消高亮
    const relTarget = event.relatedTarget as Node | null;
    if (event.currentTarget.contains(relTarget)) return;
    setIsDropTargetActive(false);
  }, []);

  const handleContainerDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropTargetActive(false);
    const url = event.dataTransfer.getData('application/canvas-node-image-url');
    if (!url) return;
    onGalleryImagesChange(node.nodeId, [...images, url]);
  }, [images, node.nodeId, onGalleryImagesChange]);

  // ── 删除单张图片 ──
  const removeImage = useCallback((index: number) => {
    const next = [...images];
    next.splice(index, 1);
    onGalleryImagesChange(node.nodeId, next);
  }, [images, node.nodeId, onGalleryImagesChange]);

  const colCount = images.length <= 1 ? 1 : images.length <= 4 ? 2 : 3;
  const cellSize = Math.floor(((node.width || 480) - 24) / colCount - 8);

  return (
    <div
      className={cn(
        'relative min-h-32 rounded-xl border-2 border-dashed transition-colors duration-150',
        isDropTargetActive
          ? 'border-[#C8F88D] bg-[#C8F88D]/5'
          : images.length === 0
            ? 'border-zinc-300 dark:border-[#4A4C4D]'
            : 'border-transparent',
      )}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {images.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-zinc-400 dark:text-[#737373]">
          <GalleryHorizontalEnd className="h-8 w-8 opacity-40" />
          <p className="text-xs">将画布中的图片拖入此处</p>
        </div>
      ) : (
        <div
          className="grid gap-2 p-1"
          style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
        >
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable
              className={cn(
                'group/cell relative overflow-hidden rounded-lg bg-zinc-100 transition-all duration-150 dark:bg-[#161616]',
                dragOverIndex === index ? 'ring-2 ring-[#C8F88D] scale-[0.97]' : '',
              )}
              style={{ height: cellSize, minHeight: 80 }}
              onDragStart={(e) => handleItemDragStart(e, index)}
              onDragOver={(e) => handleItemDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleItemDrop(e, index)}
              onDragEnd={handleItemDragEnd}
            >
              <Image
                src={url}
                alt={`Gallery image ${index + 1}`}
                fill
                sizes="200px"
                className="object-cover transition-transform duration-300 group-hover/cell:scale-105"
                unoptimized
                draggable={false}
              />
              {/* 删除按钮 */}
              <button
                type="button"
                className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover/cell:opacity-100 hover:bg-black/80"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                <X className="h-3 w-3" />
              </button>
              {/* 拖拽提示角标 */}
              <div className="absolute bottom-1 left-1 z-10 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white opacity-0 backdrop-blur group-hover/cell:opacity-100">
                拖拽排序
              </div>
            </div>
          ))}

          {/* 空格子——添加更多 */}
          <div
            className={cn(
              'flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-400 dark:border-[#4A4C4D] dark:text-[#737373]',
              dragOverIndex === images.length ? 'border-[#C8F88D] bg-[#C8F88D]/5' : '',
            )}
            style={{ height: cellSize, minHeight: 80 }}
            onDragOver={(e) => handleItemDragOver(e, images.length)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleItemDrop(e, images.length)}
          >
            <Plus className="h-5 w-5 opacity-50" />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Resize Handle 子组件
// ──────────────────────────────────────────────
interface ResizeHandleProps {
  nodeId: string;
  nodeWidth: number;
  nodeHeight: number;
  onResize: (nodeId: string, width: number, height: number) => void;
}

function ResizeHandle({ nodeId, nodeWidth, nodeHeight, onResize }: ResizeHandleProps) {
  const startRef = useRef<{ clientX: number; clientY: number; width: number; height: number } | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    startRef.current = { clientX: event.clientX, clientY: event.clientY, width: nodeWidth, height: nodeHeight };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [nodeWidth, nodeHeight]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.clientX;
    const dy = event.clientY - startRef.current.clientY;
    const newWidth = Math.max(240, startRef.current.width + dx);
    const newHeight = Math.max(160, startRef.current.height + dy);

    // 实时更新 DOM 样式（避免每帧 setState）
    const articleEl = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (articleEl) {
      articleEl.style.width = `${newWidth}px`;
      articleEl.style.minHeight = `${newHeight}px`;
    }
  }, [nodeId]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.clientX;
    const dy = event.clientY - startRef.current.clientY;
    const newWidth = Math.max(240, startRef.current.width + dx);
    const newHeight = Math.max(160, startRef.current.height + dy);
    startRef.current = null;
    onResize(nodeId, newWidth, newHeight);
  }, [nodeId, onResize]);

  return (
    <div
      className="absolute bottom-0 right-0 z-20 flex h-6 w-6 cursor-se-resize items-end justify-end pb-1 pr-1"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 三角形锯齿指示 */}
      <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-30">
        <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="10" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────
// 主 CanvasNodeCard 组件
// ──────────────────────────────────────────────
export default memo(function CanvasNodeCard({
  node,
  selected,
  isConnectionSource,
  isConnectionTarget,
  onSelect,
  onDragStart,
  onPromptChange,
  onTitleChange,
  onImageModelChange,
  onImageParamsChange,
  onRun,
  onDelete,
  onToggleCollapse,
  onEditImage,
  onInputPortClick,
  onOutputPortClick,
  onGalleryImagesChange,
  onResize,
  onUploadImage,
  onOptimizePrompt,
  isOptimizing = false,
}: CanvasNodeCardProps) {
  const latestOutput = node.outputs[node.outputs.length - 1];
  const imageParams = node.params || {};
  const isRunning = node.status === 'running';
  const isTextNode = node.nodeType === 'text';
  const isImageNode = node.nodeType === 'image';
  const isGalleryNode = node.nodeType === 'gallery';
  const isGenerationNode = isTextNode || isImageNode || isGalleryNode;
  const isCollapsed = Boolean(node.isCollapsed && isImageNode);
  const progress = Math.max(0, Math.min(1, node.progress ?? (isRunning ? 0.08 : 0)));
  const progressPercent = Math.round(progress * 100);
  const etaLabel = formatEta(node.etaSeconds);
  const providers = useAPIConfigStore((state) => state.providers);
  const getModelEntryById = useAPIConfigStore((state) => state.getModelEntryById);
  const contextModels = getContextModelOptions(providers, 'infinite-canvas', 'image');
  const modelOptions = contextModels.length > 0 ? contextModels : INFINITE_CANVAS_MODELS.map((item) => ({ id: item.id, displayName: item.label }));
  const selectedModelMeta = getModelEntryById(node.modelId || DEFAULT_INFINITE_CANVAS_MODEL_ID);
  const supportsImageSize = selectedModelMeta?.capabilities?.supportsImageSize ?? true;
  const supportsBatch = selectedModelMeta?.capabilities?.supportsBatch ?? true;
  const allowedImageSizes = selectedModelMeta?.capabilities?.allowedImageSizes?.length
    ? selectedModelMeta.capabilities.allowedImageSizes
    : (['1K', '2K', '4K'] as const);
  const allowedCanvasImageSizes = INFINITE_IMAGE_SIZES.filter((size) => {
    const normalized = normalizeImageSizeToken(size);
    return normalized ? allowedImageSizes.includes(normalized) : false;
  });
  const imageSizeOptions = allowedCanvasImageSizes.length > 0 ? allowedCanvasImageSizes : INFINITE_IMAGE_SIZES;
  const maxBatchSize = Math.max(1, selectedModelMeta?.capabilities?.maxBatchSize || 1);
  const batchSizeOptions = INFINITE_BATCH_SIZES.filter((batch) => batch <= maxBatchSize);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // 标题自动聚焦后全选文本
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/') && onUploadImage) {
        onUploadImage(node.nodeId, file);
      }
    },
    [node.nodeId, onUploadImage],
  );

  return (
    <article
      data-node-id={node.nodeId}
      className={cn(
        'group absolute flex flex-col rounded-2xl border bg-white shadow-lg dark:bg-[#2C2D2F]',
        selected
          ? 'border-[#343434] dark:border-[#c8f88d7d] ring-4 ring-zinc-900/10 dark:ring-[#C8F88D]/20 z-10'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-[#4A4C4D] dark:hover:border-[#737373] z-0 hover:z-10',
        isRunning && !selected ? 'ring-4 ring-amber-500/20 border-amber-500/50 dark:border-amber-400/50' : '',
        node.errorMsg && !selected ? 'ring-4 ring-rose-500/20 border-rose-500/50 dark:border-rose-400/50 animate-[shake_0.4s_ease-in-out_0s_1]' : '',
        isGalleryNode ? 'border-violet-200 dark:border-violet-900/60' : '',
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        willChange: 'transform',
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        onSelect(node.nodeId, event.shiftKey || event.metaKey || event.ctrlKey);
        onDragStart(node.nodeId, event.clientX, event.clientY);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {/* 悬浮工具栏 (Node Action Bar) */}
      <div
        className={cn(
          'absolute -top-14 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-200 bg-white p-1.5 shadow-md transition-all duration-200 dark:border-[#343434] dark:bg-[#1C1C1C]',
          selected
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-1 pointer-events-none'
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isGenerationNode ? (
          <>
            <Select
              value={node.modelId || DEFAULT_INFINITE_CANVAS_MODEL_ID}
              onValueChange={(value) => onImageModelChange(node.nodeId, value)}
            >
              <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 text-[11px] font-medium text-zinc-900 hover:bg-zinc-100 focus:ring-0 dark:text-[#D9D9D9] dark:hover:bg-[#2C2D2F]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mx-0.5 h-3.5 w-px bg-zinc-300 dark:bg-[#343434]" />

            <Select
              value={imageParams.aspectRatio || '1:1'}
              onValueChange={(value) => onImageParamsChange(node.nodeId, { aspectRatio: value })}
            >
              <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 text-[11px] font-medium text-zinc-900 hover:bg-zinc-100 focus:ring-0 dark:text-[#D9D9D9] dark:hover:bg-[#2C2D2F]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INFINITE_ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mx-0.5 h-3.5 w-px bg-zinc-300 dark:bg-[#343434]" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-[#A3A3A3] dark:hover:bg-[#2C2D2F] dark:hover:text-[#D9D9D9]"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-48 border-zinc-200 bg-white p-3 shadow-xl dark:border-[#343434] dark:bg-[#1C1C1C]"
                align="center"
                side="top"
                sideOffset={10}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="space-y-3">
                  {supportsImageSize && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-zinc-500 dark:text-[#A3A3A3]">尺寸 (Image Size)</p>
                      <Select
                        value={imageParams.imageSize || imageSizeOptions[0]}
                        onValueChange={(value) => onImageParamsChange(node.nodeId, { imageSize: value })}
                      >
                        <SelectTrigger className="h-7 border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-900 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#D9D9D9]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {imageSizeOptions.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {supportsBatch && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-zinc-500 dark:text-[#A3A3A3]">批量 (Batch Size)</p>
                      <Select
                        value={String(Math.min(imageParams.batchSize || 1, batchSizeOptions[batchSizeOptions.length - 1] || 1))}
                        onValueChange={(value) => onImageParamsChange(node.nodeId, { batchSize: Number(value) })}
                      >
                        <SelectTrigger className="h-7 border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-900 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#D9D9D9]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {batchSizeOptions.map((batch) => (
                            <SelectItem key={batch} value={String(batch)}>
                              {batch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <div className="mx-0.5 h-3.5 w-px bg-zinc-300 dark:bg-[#343434]" />
          </>
        ) : null}

        {isTextNode && onOptimizePrompt ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-[#A3A3A3] dark:hover:bg-[#2C2D2F] dark:hover:text-[#D9D9D9]',
                isOptimizing && 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30',
              )}
              onClick={(event) => {
                event.stopPropagation();
                onOptimizePrompt(node.nodeId);
              }}
              disabled={isOptimizing || isRunning}
              title={isOptimizing ? '优化中' : '优化 Prompt'}
            >
              {isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
            </Button>
            <div className="mx-0.5 h-3.5 w-px bg-zinc-300 dark:bg-[#343434]" />
          </>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-[#A3A3A3] dark:hover:bg-[#2C2D2F] dark:hover:text-[#D9D9D9]',
            isRunning && 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
          )}
          onClick={(event) => {
            event.stopPropagation();
            onRun(node.nodeId);
          }}
          disabled={isRunning || isOptimizing}
          title={isRunning ? '生成中' : '运行节点'}
        >
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-zinc-500 hover:bg-rose-100 hover:text-rose-600 dark:text-[#A3A3A3] dark:hover:bg-rose-500/20 dark:hover:text-rose-300"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(node.nodeId);
          }}
          title="删除节点"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 放大 Hitbox 并带微动效的输入端口 */}
      <button
        type="button"
        className="absolute -left-4 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onInputPortClick(node.nodeId);
        }}
        title="输入端口"
      >
        <div
          className={cn(
            'h-3.5 w-3.5 rounded-full border transition-all duration-200',
            isConnectionTarget
              ? 'scale-125 border-[#C8F88D] bg-[#C8F88D] shadow-[0_0_0_4px_rgba(200,248,141,0.25)]'
              : 'border-zinc-300 bg-white ring-2 ring-transparent group-hover:border-zinc-400 dark:border-[#6C6E6F] dark:bg-[#161616] dark:group-hover:border-[#A3A3A3]',
          )}
        />
      </button>

      {/* 放大 Hitbox 并带微动效的输出端口 */}
      <button
        type="button"
        className="absolute -right-4 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onOutputPortClick(node.nodeId);
        }}
        title="输出端口"
      >
        <div
          className={cn(
            'h-3.5 w-3.5 rounded-full border transition-all duration-200',
            isConnectionSource
              ? 'scale-125 border-[#C8F88D] bg-[#C8F88D] shadow-[0_0_0_4px_rgba(200,248,141,0.25)]'
              : 'border-zinc-300 bg-white ring-2 ring-transparent group-hover:border-zinc-400 dark:border-[#6C6E6F] dark:bg-[#161616] dark:group-hover:border-[#A3A3A3]',
          )}
        />
      </button>

      {/* 标题拖拽区 */}
      <div
        className="flex-none w-full rounded-t-2xl px-3 py-2 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {isGalleryNode && (
              <GalleryHorizontalEnd className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
            )}
            {isEditingTitle ? (
              <Input
                ref={inputRef}
                autoFocus
                value={node.title}
                onChange={(event) => onTitleChange(node.nodeId, event.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                  }
                }}
                className="h-7 w-32 border-transparent bg-transparent px-0 text-sm font-semibold text-zinc-900 focus-visible:ring-0 dark:text-[#D9D9D9]"
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="cursor-text select-none text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
              >
                {node.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isImageNode ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-[#A3A3A3] dark:hover:bg-[#4A4C4D] dark:hover:text-[#D9D9D9]"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse(node.nodeId);
                }}
                title={isCollapsed ? '展开节点' : '折叠节点'}
              >
                {isCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            ) : null}
            <span className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide', isGalleryNode ? 'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300' : STATUS_COLOR[node.status])}>
              {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)] dark:bg-amber-300" />}
              {isGalleryNode ? (isRunning ? node.status : 'gallery') : node.status}
            </span>
          </div>
        </div>
      </div>

      {/* 核心内容区 */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2 p-3 pt-1">

        {/* Gallery 节点内容 */}
        {isGalleryNode ? (
          <>
            <Textarea
              value={node.prompt || ''}
              onChange={(event) => onPromptChange(node.nodeId, event.target.value)}
              placeholder="输入图片生成 Prompt，点击运行批量生成..."
              className="min-h-16 resize-none border-none bg-zinc-50 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-violet-300/60 dark:bg-[#161616] dark:text-[#D9D9D9] dark:placeholder:text-[#737373] dark:focus-visible:ring-violet-700/50"
              onPointerDown={(e) => e.stopPropagation()}
            />
            <GalleryNodeCard
              node={node}
              onGalleryImagesChange={onGalleryImagesChange}
            />
          </>
        ) : isCollapsed ? (
          <>
            {latestOutput?.outputType === 'image' && latestOutput.assetUrl ? (
              <button
                type="button"
                className="relative h-20 w-full overflow-hidden rounded-lg bg-zinc-100 text-left dark:bg-[#161616]"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditImage?.(node.nodeId);
                }}
              >
                <Image
                  src={latestOutput.assetUrl}
                  alt={node.title}
                  fill
                  sizes="340px"
                  className="object-cover transition-transform duration-300 hover:scale-105"
                  unoptimized
                />
              </button>
            ) : (
              <p className="line-clamp-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-500 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#A3A3A3]">
                {(node.prompt || '').trim() || '折叠状态：暂无内容'}
              </p>
            )}
          </>
        ) : (
          <>
            <Textarea
              value={node.prompt || ''}
              onChange={(event) => onPromptChange(node.nodeId, event.target.value)}
              placeholder={node.nodeType === 'text' ? '输入基础 Prompt，点击优化或直接生成...' : '输入图片生成 Prompt...'}
              className="flex-1 min-h-[80px] resize-none border-none bg-zinc-50 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-300 dark:bg-[#161616] dark:text-[#D9D9D9] dark:placeholder:text-[#737373] dark:focus-visible:ring-[#4A4C4D]"
              onPointerDown={(e) => e.stopPropagation()}
            />

            {isOptimizing ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  正在优化 Prompt，将生成 4 个候选结果
                </span>
              </div>
            ) : null}

            {latestOutput?.outputType === 'text' ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-xs text-zinc-900 dark:border-[#C8F88D]/20 dark:bg-[#C8F88D]/10 dark:text-[#D9D9D9]">
                {latestOutput.textContent || '空文本输出'}
              </div>
            ) : null}

            {latestOutput?.outputType === 'image' && latestOutput.assetUrl ? (
              <div
                className="group/img relative w-full overflow-hidden rounded-lg bg-zinc-100 text-left dark:bg-[#161616]"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/canvas-node-image-url', latestOutput.assetUrl!);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <img
                  src={latestOutput.assetUrl}
                  alt={node.title}
                  className="block w-full h-auto object-contain transition-transform duration-500 group-hover/img:scale-105"
                  draggable={false}
                />
                {onEditImage ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 opacity-0 rounded-lg border border-[#4A4C4D] bg-[#161616]/85 px-2 py-1 text-[11px] text-[#D9D9D9] backdrop-blur transition-opacity group-hover/img:opacity-100">
                    <Pencil className="h-3 w-3" />
                    编辑
                  </span>
                ) : null}
                {/* 拖拽到 Gallery 的提示 */}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 opacity-0 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur transition-opacity group-hover/img:opacity-100">
                  拖入多图节点
                </span>
              </div>
            ) : isImageNode && !node.inputAssetId ? (
              <div
                className="group/upload relative flex h-full min-h-[120px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#737373] dark:hover:border-[#737373] dark:hover:bg-[#2C2D2F]"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadImage) {
                      onUploadImage(node.nodeId, file);
                    }
                    e.target.value = '';
                  }}
                />
                <Upload className="mb-2 h-6 w-6 opacity-50" />
                <p className="text-xs">点击或拖拽上传图片</p>
              </div>
            ) : null}
          </>
        )}

        {isRunning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-200">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在生成
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-500/20">
              <div
                className="h-full rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-[width] duration-300 ease-out dark:bg-amber-400"
                style={{ width: `${Math.max(4, progressPercent)}%` }}
              />
            </div>
            {etaLabel ? (
              <p className="mt-1 text-[10px] text-amber-700/90 dark:text-amber-200/90">
                预计剩余 {etaLabel}
              </p>
            ) : null}
          </div>
        ) : null}

        {node.errorMsg ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {node.errorMsg}
          </div>
        ) : null}
      </div>

      {/* Resize Handle（gallery + image 节点均支持） */}
      {(isGalleryNode || isImageNode) && (
        <ResizeHandle
          nodeId={node.nodeId}
          nodeWidth={node.width}
          nodeHeight={node.height}
          onResize={onResize}
        />
      )}
    </article>
  );
});
