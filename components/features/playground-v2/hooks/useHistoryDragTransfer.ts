import { useCallback, useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Generation } from '@/types/database';
import { projectStore } from '@/lib/store/project-store';

interface UseHistoryDragTransferParams {
  generationHistory: Generation[];
  selectedHistoryIds: Set<string>;
  setGlobalGenerationHistory: (updater: (prev: Generation[]) => Generation[]) => void;
  setIsSelectionMode: (value: boolean) => void;
  clearHistorySelection: () => void;
  toast: (options: { title: string; description?: string }) => void;
}

export function useHistoryDragTransfer({
  generationHistory,
  selectedHistoryIds,
  setGlobalGenerationHistory,
  setIsSelectionMode,
  clearHistorySelection,
  toast,
}: UseHistoryDragTransferParams) {
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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { over } = event;
    if (!over) {
      return;
    }

    const selectedItems = generationHistory.filter((h) => selectedHistoryIds.has(h.id));

    if (over.data.current?.type === 'project') {
      const targetProjectId = over.data.current.projectId as string;

      await projectStore.addGenerationsToProject(targetProjectId, selectedItems);

      setGlobalGenerationHistory((prev) => prev.map((item) => (
        selectedHistoryIds.has(item.id) ? { ...item, projectId: targetProjectId } : item
      )));

      toast({ title: 'Success', description: `Moved ${selectedItems.length} items to project` });
      setIsSelectionMode(false);
      clearHistorySelection();
    } else if (over.data.current?.type === 'new-project') {
      const newProject = await projectStore.createProjectWithHistory('New Project', selectedItems);

      setGlobalGenerationHistory((prev) => prev.map((item) => (
        selectedHistoryIds.has(item.id) ? { ...item, projectId: newProject.id } : item
      )));

      toast({ title: 'Success', description: `Created new project with ${selectedItems.length} items` });
      setIsSelectionMode(false);
      clearHistorySelection();
    }
  }, [
    clearHistorySelection,
    generationHistory,
    selectedHistoryIds,
    setGlobalGenerationHistory,
    setIsSelectionMode,
    toast,
  ]);

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
