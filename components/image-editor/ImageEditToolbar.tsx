"use client";

import type { ComponentType } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { ImageEditorTool } from './types';

interface ToolItem {
  id: ImageEditorTool;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface ImageEditToolbarProps {
  tool: ImageEditorTool;
  toolItems: ToolItem[];
  onToolChange: (tool: ImageEditorTool) => void;
  onOpenFilePicker: () => void;
  brushColor: string;
  brushWidth: number;
  onBrushColorChange: (color: string) => void;
  onBrushWidthChange: (width: number) => void;
  submitting: boolean;
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImageEditToolbar({
  tool,
  toolItems,
  onToolChange,
  onOpenFilePicker,
  brushColor,
  brushWidth,
  onBrushColorChange,
  onBrushWidthChange,
  submitting,
  canConfirm,
  onCancel,
  onConfirm,
}: ImageEditToolbarProps) {
  return (
    <div className="mt-2 mx-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-none bg-[#0F1017] p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {toolItems.map((item) => {
          const Icon = item.icon;
          const isActive = tool === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onClick={() => onToolChange(item.id)}
              className={cn(
                'inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs transition-colors',
                isActive
                  ? 'border-white/20 bg-[#E3FF9C] font-medium text-black'
                  : 'border-none bg-[#2c2d2f] font-medium text-white/50',
              )}
            >
              <Icon className="h-2 w-2" />
              {item.label}
            </Button>
          );
        })}

        <div className="h-6 w-px border border-white/10" />

        <Button
          type="button"
          variant="light"
          aria-label="上传图片"
          className="inline-flex h-9 w-9 items-center gap-2 rounded-xl border-[#4A4C4D] bg-white/10 px-3 text-xs font-medium text-[#D9D9D9] transition-colors hover:bg-white/15 hover:text-white"
          onClick={onOpenFilePicker}
        >
          <Upload className="h-2 w-3" />
        </Button>

        {tool === 'brush' ? (
        
          
          <div
            data-testid="image-edit-brush-controls"
            className="flex min-w-[280px] h-9 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            
            <label className="flex items-center gap-2 text-xs text-[#D9D9D9]">
              <span>颜色</span>
              <input
                aria-label="画笔颜色"
                type="color"
                value={brushColor}
                onChange={(event) => onBrushColorChange(event.target.value)}
                className="h-7 w-10 cursor-pointer rounded-xl ] bg-transparent p-0"
              />
            </label>

            <div className="flex min-w-[180px] flex-1 items-center gap-3">
              <span className="shrink-0 text-xs text-[#D9D9D9]">粗细 {brushWidth}px</span>
              <Slider
                aria-label="画笔粗细"
                min={1}
                max={24}
                step={1}
                value={[brushWidth]}
                onValueChange={(value) => onBrushWidthChange(value[0] || 1)}
                className="flex-1"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="light"
          className="h-9 rounded-xl bg-white/10 text-sm text-white"
          onClick={onCancel}
          disabled={submitting}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="light"
          className="h-9 rounded-xl border-0 bg-white text-sm text-[#000000] hover:text-black"
          onClick={onConfirm}
          disabled={!canConfirm || submitting}
        >
          {submitting ? '处理中...' : '确认编辑'}
        </Button>
      </div>
    </div>
  );
}
