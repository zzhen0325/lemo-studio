'use client';

import type React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableImageCard } from './SortableImageCard';
import type { DatasetImage } from './types';

type DndSensors = React.ComponentProps<typeof DndContext>['sensors'];

interface CollectionDetailGridViewProps {
  sensors: DndSensors;
  gridColumns: number;
  images: DatasetImage[];
  selectedIds: Set<string>;
  draggedId: string | null;
  draggedSize: { width: number; height: number } | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragStart: React.ComponentProps<typeof DndContext>['onDragStart'];
  onDragEnd: React.ComponentProps<typeof DndContext>['onDragEnd'];
  onDeleteImage: (img: DatasetImage) => void;
  onSelect: (id: string, shiftKey?: boolean) => void;
}

export function CollectionDetailGridView({
  sensors,
  gridColumns,
  images,
  selectedIds,
  draggedId,
  draggedSize,
  onUpload,
  onDragStart,
  onDragEnd,
  onDeleteImage,
  onSelect,
}: CollectionDetailGridViewProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 space-y-4 min-h-0">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
        >
          <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-[#2e2e2e] bg-[#161616] rounded-2xl aspect-square hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Plus className="h-8 w-8 text-zinc-500 group-hover:text-primary mb-2 transition-colors" />
              <span className="text-xs text-zinc-500 font-medium group-hover:text-primary transition-colors">Add Image</span>
            </div>
            <input
              type="file"
              multiple
              accept="image/*,.txt"
              className="hidden"
              onChange={onUpload}
            />
          </label>

          <SortableContext items={images.map((item) => item.id)} strategy={rectSortingStrategy}>
            {images.map((img) => (
              <SortableImageCard
                key={img.id}
                img={img}
                gridColumns={gridColumns}
                onDelete={onDeleteImage}
                isSelected={selectedIds.has(img.id)}
                onSelect={onSelect}
              />
            ))}
          </SortableContext>
        </div>
      </div>

      {typeof window !== 'undefined' &&
        createPortal(
          <DragOverlay>
            {draggedId && draggedSize ? (
              <div
                className="relative aspect-square bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden opacity-80 shadow-2xl cursor-grabbing pointer-events-none"
                style={{
                  width: draggedSize.width,
                  height: draggedSize.height,
                }}
              >
                <Image
                  src={images.find((item) => item.id === draggedId)?.url || ''}
                  alt="Dragging"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
