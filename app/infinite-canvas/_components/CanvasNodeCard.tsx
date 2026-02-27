"use client";

import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Play,
  Settings2,
  Trash2,
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
  INFINITE_ASPECT_RATIOS,
  INFINITE_BATCH_SIZES,
  INFINITE_CANVAS_MODELS,
  INFINITE_IMAGE_SIZES,
} from '../_lib/constants';

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

export default function CanvasNodeCard({
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
}: CanvasNodeCardProps) {
  const latestOutput = node.outputs[node.outputs.length - 1];
  const imageParams = node.params || {};
  const isRunning = node.status === 'running';
  const isImageNode = node.nodeType === 'image';
  const isCollapsed = Boolean(node.isCollapsed && isImageNode);
  const progress = Math.max(0, Math.min(1, node.progress ?? (isRunning ? 0.08 : 0)));
  const progressPercent = Math.round(progress * 100);
  const etaLabel = formatEta(node.etaSeconds);

  return (
    <article
      className={cn(
        'group absolute rounded-2xl border bg-white shadow-lg transition-all duration-200 dark:bg-[#2C2D2F]',
        selected
          ? 'border-[#343434] dark:border-[#c8f88d7d] ring-4 ring-zinc-900/10 dark:ring-[#C8F88D]/20 z-10'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-[#4A4C4D] dark:hover:border-[#737373] z-0 hover:z-10',
        isRunning && !selected ? 'ring-4 ring-amber-500/20 border-amber-500/50 dark:border-amber-400/50' : '',
        node.errorMsg && !selected ? 'ring-4 ring-rose-500/20 border-rose-500/50 dark:border-rose-400/50 animate-[shake_0.4s_ease-in-out_0s_1]' : ''
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        minHeight: node.height,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(node.nodeId, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
    >
      {/* 悬浮工具栏 (Node Action Bar) */}
      <div
        className={cn(
          'absolute -top-[42px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white p-1.5 shadow-md transition-all duration-200 dark:border-[#343434] dark:bg-[#1C1C1C]',
          selected
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-1 pointer-events-none'
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isImageNode ? (
          <>
            <Select
              value={node.modelId || 'gemini-3-pro-image-preview'}
              onValueChange={(value) => onImageModelChange(node.nodeId, value)}
            >
              <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 text-[11px] font-medium text-zinc-900 hover:bg-zinc-100 focus:ring-0 dark:text-[#D9D9D9] dark:hover:bg-[#2C2D2F]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INFINITE_CANVAS_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
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
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-500 dark:text-[#A3A3A3]">尺寸 (Image Size)</p>
                    <Select
                      value={imageParams.imageSize || '1024x1024'}
                      onValueChange={(value) => onImageParamsChange(node.nodeId, { imageSize: value })}
                    >
                      <SelectTrigger className="h-7 border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-900 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#D9D9D9]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INFINITE_IMAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-500 dark:text-[#A3A3A3]">批量 (Batch Size)</p>
                    <Select
                      value={String(imageParams.batchSize || 1)}
                      onValueChange={(value) => onImageParamsChange(node.nodeId, { batchSize: Number(value) })}
                    >
                      <SelectTrigger className="h-7 border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-900 dark:border-[#4A4C4D] dark:bg-[#161616] dark:text-[#D9D9D9]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INFINITE_BATCH_SIZES.map((batch) => (
                          <SelectItem key={batch} value={String(batch)}>
                            {batch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
          disabled={isRunning}
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

      <button
        type="button"
        className="w-full cursor-move rounded-t-2xl px-3 py-2 text-left"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          onDragStart(node.nodeId, event.clientX, event.clientY);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <Input
            value={node.title}
            onChange={(event) => onTitleChange(node.nodeId, event.target.value)}
            className="h-7 border-transparent bg-transparent px-0 text-sm font-semibold text-zinc-900 focus-visible:ring-0 dark:text-[#D9D9D9]"
          />
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
            <span className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide', STATUS_COLOR[node.status])}>
              {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)] dark:bg-amber-300" />}
              {node.status}
            </span>
          </div>
        </div>
      </button>

      {/* 核心内容区，去除了所有凌乱的控制按钮 */}
      <div className="space-y-2 p-3 pt-1">
        {isCollapsed ? (
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
              placeholder={node.nodeType === 'text' ? '输入文本内容...' : '输入图片生成 Prompt...'}
              className="min-h-20 resize-none border-none bg-zinc-50 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-300 dark:bg-[#161616] dark:text-[#D9D9D9] dark:placeholder:text-[#737373] dark:focus-visible:ring-[#4A4C4D]"
            />

            {latestOutput?.outputType === 'text' ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-xs text-zinc-900 dark:border-[#C8F88D]/20 dark:bg-[#C8F88D]/10 dark:text-[#D9D9D9]">
                {latestOutput.textContent || '空文本输出'}
              </div>
            ) : null}

            {latestOutput?.outputType === 'image' && latestOutput.assetUrl ? (
              <button
                type="button"
                className="group/img relative h-44 w-full overflow-hidden rounded-lg bg-zinc-100 text-left dark:bg-[#161616]"
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
                  className="object-cover transition-transform duration-500 group-hover/img:scale-105"
                  unoptimized
                />
                {onEditImage ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 opacity-0 rounded-lg border border-[#4A4C4D] bg-[#161616]/85 px-2 py-1 text-[11px] text-[#D9D9D9] backdrop-blur transition-opacity group-hover/img:opacity-100">
                    <Pencil className="h-3 w-3" />
                    编辑
                  </span>
                ) : null}
              </button>
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
    </article>
  );
}
