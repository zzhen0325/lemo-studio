import { useCallback, useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Generation } from '@/types/database';

export function useHistoryDragTransfer() {
  const [activeDragItem, setActiveDragItem] = useState<Generation | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.type === 'history-item') {
      setActiveDragItem(event.active.data.current.generation as Generation);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragItem(null);
    if (!event.over) {
      return;
    }
  }, []);

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
