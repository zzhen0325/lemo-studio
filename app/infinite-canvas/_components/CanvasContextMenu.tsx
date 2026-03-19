import React, { useEffect, useRef } from 'react';
import { GalleryHorizontalEnd, Plus, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (type: 'text' | 'image' | 'gallery') => void;
}

export default function CanvasContextMenu({ x, y, onClose, onSelect }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // 使用 capture 为了在其他点击事件之前捕获
    document.addEventListener('mousedown', handleClickOutside, true);
    // 阻止滚轮时关闭菜单
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "studio-panel fixed z-layer-floating min-w-[8rem] overflow-hidden rounded-md p-1 text-studio-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        left: x,
        top: y,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-studio-muted">
        添加节点
      </div>
      <div className="my-1 h-px bg-studio-border" />
      
      <button
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-studio-surface-strong focus:bg-studio-surface-strong"
        onClick={() => onSelect('text')}
      >
        <Plus className="mr-2 h-4 w-4" />
        <span>Text 节点</span>
      </button>

      <button
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-studio-surface-strong focus:bg-studio-surface-strong"
        onClick={() => onSelect('image')}
      >
        <WandSparkles className="mr-2 h-4 w-4" />
        <span>Image 节点</span>
      </button>

      <button
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-studio-surface-strong focus:bg-studio-surface-strong"
        onClick={() => onSelect('gallery')}
      >
        <GalleryHorizontalEnd className="mr-2 h-4 w-4" />
        <span>Gallery 节点</span>
      </button>
    </div>
  );
}
