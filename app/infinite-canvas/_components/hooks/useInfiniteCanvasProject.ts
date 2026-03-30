import { useCallback, useEffect, useRef, useState } from 'react';
import { getProject, saveProject } from '../../_lib/api';
import { deepClone, nowISO } from '../../_lib/helpers';
import { sanitizeName, type CanvasViewport } from '../infinite-canvas-editor-helpers';
import type { InfiniteCanvasProject } from '@/types/infinite-canvas';

const INITIAL_VIEWPORT: CanvasViewport = { x: 180, y: 120, scale: 1 };

interface UseInfiniteCanvasProjectArgs {
  projectId: string;
  onLoadError: (error: unknown) => void;
  onAutoSaveError: (error: unknown) => void;
  onProjectRouteChange: (nextProjectId: string) => void;
}

export function useInfiniteCanvasProject({
  projectId,
  onLoadError,
  onAutoSaveError,
  onProjectRouteChange,
}: UseInfiniteCanvasProjectArgs) {
  const projectRef = useRef<InfiniteCanvasProject | null>(null);
  const viewportRef = useRef(INITIAL_VIEWPORT);
  const isMountedRef = useRef(true);

  const [project, setProject] = useState<InfiniteCanvasProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [undoStack, setUndoStack] = useState<InfiniteCanvasProject[]>([]);
  const [redoStack, setRedoStack] = useState<InfiniteCanvasProject[]>([]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const markDirty = useCallback(() => {
    setDirtyVersion((value) => value + 1);
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    setProject((currentProject) => {
      if (!currentProject) return currentProject;
      const snapshot = deepClone({
        ...currentProject,
        canvasViewport: viewport,
      });
      setUndoStack((stack) => [...stack.slice(-59), snapshot]);
      setRedoStack([]);
      return currentProject;
    });
  }, [viewport]);

  const mutateProject = useCallback(
    (updater: (draft: InfiniteCanvasProject) => void, options?: { markDirty?: boolean }) => {
      setProject((prev) => {
        if (!prev) return prev;
        const draft = deepClone(prev);
        updater(draft);
        draft.updatedAt = nowISO();
        draft.nodeCount = draft.nodes.length;
        return draft;
      });

      if (options?.markDirty !== false) {
        markDirty();
      }
    },
    [markDirty],
  );

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getProject(projectId);
      const loadedProject = response.project;
      setProject(loadedProject);
      setViewport({
        x: loadedProject.canvasViewport?.x ?? INITIAL_VIEWPORT.x,
        y: loadedProject.canvasViewport?.y ?? INITIAL_VIEWPORT.y,
        scale: loadedProject.canvasViewport?.scale ?? INITIAL_VIEWPORT.scale,
      });
      setLastSavedAt(nowISO());
      setUndoStack([]);
      setRedoStack([]);
    } catch (error) {
      onLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [onLoadError, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleSelectProject = useCallback(
    (nextProjectId: string) => {
      if (!nextProjectId || nextProjectId === projectId) {
        return;
      }
      onProjectRouteChange(nextProjectId);
    },
    [onProjectRouteChange, projectId],
  );

  useEffect(() => {
    if (!project || loading || dirtyVersion === 0) return;

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const payload: InfiniteCanvasProject = {
          ...project,
          canvasViewport: viewport,
          projectName: sanitizeName(project.projectName),
        };
        await saveProject(project.projectId, payload);
        if (!isMountedRef.current) return;
        setLastSavedAt(nowISO());
      } catch (error) {
        onAutoSaveError(error);
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dirtyVersion, loading, onAutoSaveError, project, viewport]);

  return {
    project,
    setProject,
    projectRef,
    loading,
    saving,
    lastSavedAt,
    dirtyVersion,
    viewport,
    setViewport,
    viewportRef,
    undoStack,
    setUndoStack,
    redoStack,
    setRedoStack,
    markDirty,
    pushUndoSnapshot,
    mutateProject,
    handleSelectProject,
  };
}
