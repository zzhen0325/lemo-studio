"use client";

import Image from 'next/image';
import { Play, Trash2, Loader2, Settings2, Unlock, Download, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  onEditImage?: (nodeId: string) => void;
  onInputPortClick: (nodeId: string) => void;
  onOutputPortClick: (nodeId: string) => void;
}

export default function CanvasNodeCard({
  node,
  selected,
  isConnectionSource,
  onSelect,
  onDragStart,
  onPromptChange,
  onTitleChange,
  onImageModelChange,
  onImageParamsChange,
  onRun,
  onDelete,
  onEditImage,
  onInputPortClick,
  onOutputPortClick,
}: CanvasNodeCardProps) {
  const latestOutput = node.outputs[node.outputs.length - 1];
  const imageParams = node.params || {};
  const isRunning = node.status === 'running';

  return (
    <article
      className={cn(
        'absolute rounded-2xl border transition-colors shadow-lg bg-white dark:bg-[#2C2D2F]',
        selected ? 'border-[#343434] dark:border-[#c8f88d7d]  dark:ring-[#C8F88D]/20' : 'border-zinc-200 dark:border-[#4A4C4D] hover:border-zinc-300 dark:hover:border-[#737373]',
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
      {node.nodeType === 'image' && (
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full  px-3 py-1.5  z-10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Select
            value={node.modelId || 'gemini-3-pro-image-preview'}
            onValueChange={(value) => onImageModelChange(node.nodeId, value)}
          >
            <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 text-[11px] font-medium text-zinc-900 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#2C2D2F] focus:ring-0">
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

          <div className="h-4 w-px bg-zinc-300 dark:bg-[#343434]" />

          <Select
            value={imageParams.aspectRatio || '1:1'}
            onValueChange={(value) => onImageParamsChange(node.nodeId, { aspectRatio: value })}
          >
            <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 text-[11px] font-medium text-zinc-900 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#2C2D2F] focus:ring-0">
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

          <div className="h-4 w-px bg-zinc-300 dark:bg-[#343434]" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-[#A3A3A3] hover:text-zinc-900 dark:hover:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#2C2D2F]">
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-3 bg-white dark:bg-[#1C1C1C] border-zinc-200 dark:border-[#343434]"
              align="center"
              side="top"
              sideOffset={10}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-500 dark:text-[#A3A3A3]">尺寸 (Image Size)</p>
                  <Select
                    value={imageParams.imageSize || '1024x1024'}
                    onValueChange={(value) => onImageParamsChange(node.nodeId, { imageSize: value })}
                  >
                    <SelectTrigger className="h-7 border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-2 text-[11px] text-zinc-900 dark:text-[#D9D9D9]">
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
                    <SelectTrigger className="h-7 border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-2 text-[11px] text-zinc-900 dark:text-[#D9D9D9]">
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

          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-[#A3A3A3] hover:text-zinc-900 dark:hover:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#2C2D2F]">
            <Unlock className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-[#A3A3A3] hover:text-zinc-900 dark:hover:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#2C2D2F]">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <button
        type="button"
        className="w-full cursor-move rounded-t-2xl  px-3 py-2 text-left"
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
            className="h-7 border-transparent bg-transparent px-0 text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9] focus-visible:ring-0"
          />
          <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide', STATUS_COLOR[node.status])}>
            {node.status}
          </span>
        </div>
      </button>

      <div className="space-y-2 p-3">
        <Textarea
          value={node.prompt || ''}
          onChange={(event) => onPromptChange(node.nodeId, event.target.value)}
          placeholder={node.nodeType === 'text' ? '输入文本内容...' : '输入图片生成 Prompt...'}
          className="min-h-20 resize-none  border-none bg-zinc-50 dark:bg-[#161616] text-xs leading-relaxed text-zinc-900 dark:text-[#D9D9D9] placeholder:text-zinc-400 dark:placeholder:text-[#737373]"
        />



        {latestOutput?.outputType === 'text' ? (
          <div className="rounded-lg border border-zinc-200 dark:border-[#C8F88D]/20 bg-zinc-100 dark:bg-[#C8F88D]/10 p-2 text-xs text-zinc-900 dark:text-[#D9D9D9]">
            {latestOutput.textContent || '空文本输出'}
          </div>
        ) : null}

        {isRunning ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2">
            <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在生成，请稍候...
            </div>
            <div className="mt-2 h-16 animate-pulse rounded-md border border-amber-200 dark:border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/10" />
          </div>
        ) : null}

        {latestOutput?.outputType === 'image' && latestOutput.assetUrl ? (
          <button
            type="button"
            className="relative h-44 w-full overflow-hidden rounded-lg bg-zinc-100 text-left dark:bg-[#161616]"
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
              className="object-cover"
              unoptimized
            />
            {onEditImage ? (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg border border-[#4A4C4D] bg-[#161616]/85 px-2 py-1 text-[11px] text-[#D9D9D9] backdrop-blur">
                <Pencil className="h-3 w-3" />
                编辑
              </span>
            ) : null}
          </button>
        ) : null}

        {node.errorMsg ? (
          <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-2 text-[11px] text-rose-700 dark:text-rose-200">{node.errorMsg}</div>
        ) : null}

        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 rounded-lg  dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-[11px] text-zinc-900 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation();
              onRun(node.nodeId);
            }}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {isRunning ? '生成中' : '运行'}
          </Button>


        </div>
      </div>


    </article>
  );
}
