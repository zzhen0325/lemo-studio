"use client";

import React from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageEditCanvasPaneProps {
  imageSize: { width: number; height: number };
  isDraggingFile: boolean;
  isReady: boolean;
  loadError?: string;
  showUploadPlaceholder: boolean;
  onOpenFilePicker: () => void;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export function ImageEditCanvasPane({
  imageSize,
  isDraggingFile,
  isReady,
  loadError,
  showUploadPlaceholder,
  onOpenFilePicker,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: ImageEditCanvasPaneProps) {
  return (
    <div
      data-testid="image-edit-canvas-pane"
      className="relative flex min-h-0 min-w-0 flex-[1_1_0%] items-center justify-center overflow-auto rounded-2xl"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        backgroundColor: '#0F1017',
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {showUploadPlaceholder ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-sm">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'inline-flex min-h-[120px] min-w-[280px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-5 text-center transition-colors',
              isDraggingFile
                ? 'scale-[1.01] border-[#DAFFAC] bg-[#DAFFAC]/[0.05]'
                : 'border-[#4A4C4D] bg-[#0F1017]/50 backdrop-blur-sm',
            )}
            onClick={onOpenFilePicker}
          >
            <Upload className="h-5 w-5 text-[#A3A3A3]" />
            <span className="text-[#D9D9D9]">点击、拖拽或粘贴上传图片</span>
            {loadError ? (
              <span className="text-xs text-[#737373]">{loadError}</span>
            ) : null}
          </Button>
        </div>
      ) : null}

      {!showUploadPlaceholder && !isReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[#A3A3A3]">
          Thinking...
        </div>
      ) : null}

      {children}

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-[#4A4C4D] bg-[#0F1017] px-2 py-1 text-[11px] text-[#A3A3A3]">
        {imageSize.width} x {imageSize.height}
      </div>
    </div>
  );
}
