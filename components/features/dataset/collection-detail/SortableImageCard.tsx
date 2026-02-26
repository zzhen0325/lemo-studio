'use client';

import Image from 'next/image';
import { Plus, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import type { DatasetImage } from '@/components/features/dataset/collection-detail/types';
import { ImageSizeBadge } from '@/components/features/dataset/collection-detail/ImageSizeBadge';

interface SortableImageCardProps {
  img: DatasetImage;
  gridColumns: number;
  onDelete: (img: DatasetImage) => void;
  isSelected: boolean;
  onSelect: (id: string, shiftKey?: boolean) => void;
}

export function SortableImageCard({
  img,
  gridColumns,
  onDelete,
  isSelected,
  onSelect,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 'auto',
  } as const;

  return (
    <div
      ref={setNodeRef}
      id={img.id}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          onSelect(img.id, e.shiftKey);
        }
      }}
      className={`group relative aspect-square bg-card border rounded-xl overflow-hidden transition-all select-none touch-none ${isSelected
        ? 'ring-2 ring-primary border-primary shadow-[0_0_15px_oklch(var(--primary)/0.3)]'
        : 'border-white/10 hover:ring-2 hover:ring-primary/50'
        }`}
    >
      <Image
        src={img.url}
        alt={img.filename}
        fill
        className={`object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-110'}`}
        sizes={`(max-width: 768px) 33vw, ${Math.round(100 / gridColumns)}vw`}
      />

      <div className={`absolute top-3 left-3 z-10 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'}`}>
          {isSelected && <Plus className="w-4 h-4 text-primary-foreground rotate-45" />}
        </div>
      </div>

      <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 ${isDragging ? 'opacity-0' : ''}`}>
        <div className="flex justify-end">
          <div className="bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-white/80 font-mono truncate max-w-full">
            {img.filename}
          </div>
        </div>

        <div className="flex justify-center items-end h-full pb-2">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-auto px-4 shadow-lg scale-90 hover:scale-100 transition-transform"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(img);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        <div className="absolute bottom-3 left-3 opacity-80 group-hover:opacity-100 transition-opacity">
          <ImageSizeBadge src={img.url} />
        </div>
      </div>
    </div>
  );
}
