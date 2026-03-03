"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Check,
  CircleDashed,
  Copy,
  GalleryHorizontalEnd,
  History,
  Home,
  Layers,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Save,
  Square,
  Upload,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/common/use-toast';
import { ImageEditDialog, type ImageEditConfirmPayload, type ImageEditorSessionSnapshot } from '@/components/image-editor';
import {
  createProject,
  generateCanvasImage,
  getProject,
  saveImageAsset,
  saveProject,
} from '../_lib/api';
import { type InfinitePanel } from '../_lib/constants';
import {
  computeViewportCenter,
  createId,
  createGalleryNode,
  createImageNode,
  createTextNode,
  deepClone,
  nowISO,
} from '../_lib/helpers';
import { buildEditedImageNode } from '../_lib/image-edit-node';
import type {
  InfiniteCanvasAsset,
  InfiniteCanvasEdge,
  InfiniteCanvasHistoryItem,
  InfiniteCanvasNode,
  InfiniteCanvasProject,
} from '@/types/infinite-canvas';
import CanvasNodeCard from './CanvasNodeCard';
import InfiniteCanvasProjectSidebar from './InfiniteCanvasProjectSidebar';
import CanvasContextMenu from './CanvasContextMenu';

interface InfiniteCanvasEditorProps {
  projectId: string;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface DragGuide {
  axis: 'x' | 'y';
  value: number;
  start: number;
  end: number;
}

interface ConnectionTargetCandidate {
  nodeId: string;
  point: ScreenPoint;
  distance: number;
}

interface DragSnapshotNode {
  nodeId: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  isLocked: boolean;
}

type DragSession = {
  type: 'drag';
  startClient: ScreenPoint;
  nodeIds: string[];
  startPositions: Record<string, { x: number; y: number }>;
  allNodes: DragSnapshotNode[];
};

type PanSession = {
  type: 'pan';
  startClient: ScreenPoint;
  startViewport: { x: number; y: number };
};

type SelectSession = {
  type: 'select';
  startClient: ScreenPoint;
  currentClient: ScreenPoint;
  additive: boolean;
  baseSelection: string[];
};

type InteractionSession = DragSession | PanSession | SelectSession;
type AlignMode =
  | 'left'
  | 'hCenter'
  | 'right'
  | 'top'
  | 'vCenter'
  | 'bottom'
  | 'hDistribute'
  | 'vDistribute'
  | 'tidy'
  | 'topology';

interface InfiniteImageEditDialogState {
  open: boolean;
  sourceNodeId?: string;
  imageUrl: string;
  initialPrompt: string;
  initialSession?: ImageEditorSessionSnapshot;
}

function worldToScreen(viewport: { x: number; y: number; scale: number }, point: { x: number; y: number }): ScreenPoint {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

function sanitizeName(value: string) {
  const next = value.trim();
  if (!next) return '未命名项目';
  return next.slice(0, 50);
}

function getNodeOutput(node: InfiniteCanvasNode) {
  return node.outputs[node.outputs.length - 1];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildConnectionPath(source: ScreenPoint, target: ScreenPoint) {
  const handle = Math.max(60, Math.abs(target.x - source.x) * 0.4);
  return `M ${source.x} ${source.y} C ${source.x + handle} ${source.y}, ${target.x - handle} ${target.y}, ${target.x} ${target.y}`;
}

function formatEtaLabel(seconds?: number) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds <= 0) {
    return '--';
  }
  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }
  const mins = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${mins}m ${rest}s`;
}



function intersectsRect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x > b.x + b.width
    || a.x + a.width < b.x
    || a.y > b.y + b.height
    || a.y + a.height < b.y
  );
}

function estimateNodeRunSeconds(node: InfiniteCanvasNode, referenceCount: number) {
  const batch = Math.max(1, node.params?.batchSize || 1);
  return Math.max(8, Math.round(12 + batch * 7 + referenceCount * 4));
}

function findConnectionTargetCandidate(
  project: InfiniteCanvasProject | null,
  sourceNodeId: string | null,
  pointerPosition: ScreenPoint | null,
  viewport: { x: number; y: number; scale: number },
): ConnectionTargetCandidate | null {
  if (!project || !sourceNodeId || !pointerPosition) return null;
  const sourceNode = project.nodes.find((node) => node.nodeId === sourceNodeId);
  if (!sourceNode) return null;

  const maxDistance = 32;
  let best: ConnectionTargetCandidate | null = null;

  for (const node of project.nodes) {
    if (!canConnect(sourceNode, node)) continue;
    if (project.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === node.nodeId)) continue;
    if (createsCycle(project.edges, sourceNodeId, node.nodeId)) continue;

    const point = worldToScreen(viewport, {
      x: node.position.x,
      y: node.position.y + node.height / 2,
    });
    const distance = Math.hypot(pointerPosition.x - point.x, pointerPosition.y - point.y);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance) {
      best = {
        nodeId: node.nodeId,
        point,
        distance,
      };
    }
  }

  return best;
}



function canConnect(source: InfiniteCanvasNode | undefined, target: InfiniteCanvasNode | undefined) {
  if (!source || !target) return false;
  if (source.nodeId === target.nodeId) return false;

  if (source.nodeType === 'text' && target.nodeType === 'image') return true;
  if (source.nodeType === 'text' && target.nodeType === 'text') return true;
  if (source.nodeType === 'image' && target.nodeType === 'image') return true;
  if (source.nodeType === 'image' && target.nodeType === 'text') return true;
  return false;
}

function createsCycle(edges: InfiniteCanvasEdge[], sourceNodeId: string, targetNodeId: string) {
  const graph = new Map<string, string[]>();

  for (const edge of edges) {
    const list = graph.get(edge.sourceNodeId) || [];
    list.push(edge.targetNodeId);
    graph.set(edge.sourceNodeId, list);
  }

  const appended = graph.get(sourceNodeId) || [];
  appended.push(targetNodeId);
  graph.set(sourceNodeId, appended);

  const visited = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (nodeId === sourceNodeId) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    const nextNodes = graph.get(nodeId) || [];
    for (const next of nextNodes) {
      if (dfs(next)) {
        return true;
      }
    }

    return false;
  };

  return dfs(targetNodeId);
}

export default function InfiniteCanvasEditor({ projectId }: InfiniteCanvasEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clipboardRef = useRef<{ nodes: InfiniteCanvasNode[]; edges: InfiniteCanvasEdge[] } | null>(null);
  const interactionRef = useRef<InteractionSession | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const progressTimersRef = useRef<Map<string, number>>(new Map());
  const isSpacePressedRef = useRef(false);
  const projectRef = useRef<InfiniteCanvasProject | null>(null);
  const viewportRef = useRef({ x: 180, y: 120, scale: 1 });
  // 拖拽时记录当前偏移，避免每帧触发 React 渲染
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  const [project, setProject] = useState<InfiniteCanvasProject | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<InfinitePanel | null>(null);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [viewport, setViewport] = useState({ x: 180, y: 120, scale: 1 });
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<ScreenPoint | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragGuides, setDragGuides] = useState<DragGuide[]>([]);
  const [undoStack, setUndoStack] = useState<InfiniteCanvasProject[]>([]);
  const [redoStack, setRedoStack] = useState<InfiniteCanvasProject[]>([]);
  const [pendingAutoRunNodeId, setPendingAutoRunNodeId] = useState<string | null>(null);
  const [imageEditDialogState, setImageEditDialogState] = useState<InfiniteImageEditDialogState>({
    open: false,
    imageUrl: '',
    initialPrompt: '',
    initialSession: undefined,
    sourceNodeId: undefined,
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isMountedRef = useRef(true);
  const cancelRunRef = useRef(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const controllers = abortControllersRef.current;
    const timers = progressTimersRef.current;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      controllers.forEach((controller) => controller.abort());
      timers.forEach((timerId) => window.clearInterval(timerId));
      timers.clear();
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
        x: loadedProject.canvasViewport?.x ?? 180,
        y: loadedProject.canvasViewport?.y ?? 120,
        scale: loadedProject.canvasViewport?.scale ?? 1,
      });
      setSelectedNodeIds([]);
      setLastSavedAt(nowISO());
      setUndoStack([]);
      setRedoStack([]);
    } catch (error) {
      toast({
        title: '项目加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
      router.push('/infinite-canvas');
    } finally {
      setLoading(false);
    }
  }, [projectId, router, toast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleSelectProject = useCallback(
    (nextProjectId: string) => {
      if (!nextProjectId || nextProjectId === projectId) {
        return;
      }
      router.push(`/infinite-canvas/editor/${nextProjectId}`);
    },
    [projectId, router],
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
        toast({
          title: '自动保存失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [project, viewport, dirtyVersion, loading, toast]);

  const viewportToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        return { x: 0, y: 0 };
      }
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      };
    },
    [viewport],
  );

  const handleSelectNode = useCallback((nodeId: string, additive: boolean) => {
    setSelectedNodeIds((prev) => {
      if (!additive) {
        return [nodeId];
      }
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, []);

  const createNodeAtCenter = useCallback(
    (nodeType: 'text' | 'image') => {
      if (!project || !canvasRef.current) return;

      pushUndoSnapshot();
      const center = computeViewportCenter(viewport, {
        width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight,
      });
      const offset = project.nodes.length * 14;
      const node = nodeType === 'text' ? createTextNode(center.x + offset, center.y + offset) : createImageNode(center.x + offset, center.y + offset);

      mutateProject((draft) => {
        draft.nodes.push(node);
      });
      setSelectedNodeIds([node.nodeId]);
    },
    [mutateProject, project, pushUndoSnapshot, viewport],
  );

  const updateNodeById = useCallback(
    (nodeId: string, patch: Partial<InfiniteCanvasNode>) => {
      mutateProject((draft) => {
        draft.nodes = draft.nodes.map((node) => {
          if (node.nodeId !== nodeId) return node;
          return {
            ...node,
            ...patch,
            updatedAt: nowISO(),
          };
        });
      });
    },
    [mutateProject],
  );

  const updateImageNodeConfig = useCallback(
    (
      nodeId: string,
      patch: {
        modelId?: string;
        params?: Partial<NonNullable<InfiniteCanvasNode['params']>>;
      },
    ) => {
      mutateProject((draft) => {
        const node = draft.nodes.find((item) => item.nodeId === nodeId);
        if (!node || node.nodeType !== 'image') return;

        if (patch.modelId !== undefined) {
          node.modelId = patch.modelId;
        }

        if (patch.params) {
          node.params = {
            ...(node.params || {}),
            ...patch.params,
          };
        }

        node.updatedAt = nowISO();
      });
    },
    [mutateProject],
  );

  const toggleNodeCollapse = useCallback(
    (nodeId: string) => {
      pushUndoSnapshot();
      mutateProject((draft) => {
        const node = draft.nodes.find((item) => item.nodeId === nodeId);
        if (!node || node.nodeType !== 'image') return;

        if (node.isCollapsed) {
          const restoreHeight = Math.max(220, node.expandedHeight || 320);
          node.isCollapsed = false;
          node.height = restoreHeight;
          node.expandedHeight = undefined;
        } else {
          node.expandedHeight = node.height;
          node.isCollapsed = true;
          node.height = 132;
        }
        node.updatedAt = nowISO();
      });
    },
    [mutateProject, pushUndoSnapshot],
  );

  const alignSelectedNodes = useCallback(
    (mode: AlignMode) => {
      if (!project) return;

      const selectedSet = new Set(selectedNodeIds);
      const selectedNodes = project.nodes.filter((node) => selectedSet.has(node.nodeId) && !node.isLocked);
      const targetNodes = mode === 'topology' && selectedNodes.length < 2
        ? project.nodes.filter((node) => !node.isLocked)
        : selectedNodes;
      const targetSet = new Set(targetNodes.map((node) => node.nodeId));

      if (targetNodes.length < 2) {
        toast({ title: '至少选择两个节点', description: '请先多选节点后再对齐或排列。' });
        return;
      }

      if ((mode === 'hDistribute' || mode === 'vDistribute') && targetNodes.length < 3) {
        toast({ title: '至少选择三个节点', description: '横向/纵向分布需要至少 3 个节点。' });
        return;
      }

      const left = Math.min(...targetNodes.map((node) => node.position.x));
      const right = Math.max(...targetNodes.map((node) => node.position.x + node.width));
      const top = Math.min(...targetNodes.map((node) => node.position.y));
      const bottom = Math.max(...targetNodes.map((node) => node.position.y + node.height));
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;

      pushUndoSnapshot();
      mutateProject((draft) => {
        const targets = draft.nodes.filter((node) => targetSet.has(node.nodeId) && !node.isLocked);
        if (targets.length < 2) return;

        if (mode === 'left') {
          targets.forEach((node) => {
            node.position.x = left;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'hCenter') {
          targets.forEach((node) => {
            node.position.x = centerX - node.width / 2;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'right') {
          targets.forEach((node) => {
            node.position.x = right - node.width;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'top') {
          targets.forEach((node) => {
            node.position.y = top;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'vCenter') {
          targets.forEach((node) => {
            node.position.y = centerY - node.height / 2;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'bottom') {
          targets.forEach((node) => {
            node.position.y = bottom - node.height;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'hDistribute') {
          const sorted = [...targets].sort((a, b) => a.position.x - b.position.x);
          const totalWidth = sorted.reduce((sum, node) => sum + node.width, 0);
          const span = right - left;
          const gap = (span - totalWidth) / (sorted.length - 1);
          let cursor = left;
          sorted.forEach((node) => {
            node.position.x = cursor;
            cursor += node.width + gap;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'vDistribute') {
          const sorted = [...targets].sort((a, b) => a.position.y - b.position.y);
          const totalHeight = sorted.reduce((sum, node) => sum + node.height, 0);
          const span = bottom - top;
          const gap = (span - totalHeight) / (sorted.length - 1);
          let cursor = top;
          sorted.forEach((node) => {
            node.position.y = cursor;
            cursor += node.height + gap;
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'tidy') {
          const sorted = [...targets].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
          const maxWidth = Math.max(...sorted.map((node) => node.width));
          const maxHeight = Math.max(...sorted.map((node) => node.height));
          const columns = Math.ceil(Math.sqrt(sorted.length));
          const gapX = 56;
          const gapY = 56;
          sorted.forEach((node, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            node.position.x = left + col * (maxWidth + gapX);
            node.position.y = top + row * (maxHeight + gapY);
            node.updatedAt = nowISO();
          });
          return;
        }

        if (mode === 'topology') {
          const nodeSet = new Set(targets.map((node) => node.nodeId));
          const edges = draft.edges.filter((edge) => nodeSet.has(edge.sourceNodeId) && nodeSet.has(edge.targetNodeId));
          const indegree = new Map<string, number>();
          const outgoing = new Map<string, string[]>();
          const depth = new Map<string, number>();

          targets.forEach((node) => {
            indegree.set(node.nodeId, 0);
            outgoing.set(node.nodeId, []);
            depth.set(node.nodeId, 0);
          });

          edges.forEach((edge) => {
            indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) || 0) + 1);
            const list = outgoing.get(edge.sourceNodeId) || [];
            list.push(edge.targetNodeId);
            outgoing.set(edge.sourceNodeId, list);
          });

          const queue = targets
            .filter((node) => (indegree.get(node.nodeId) || 0) === 0)
            .map((node) => node.nodeId);
          const visited = new Set<string>();

          while (queue.length > 0) {
            const nodeId = queue.shift()!;
            visited.add(nodeId);
            const nextList = outgoing.get(nodeId) || [];
            nextList.forEach((nextId) => {
              const nextDepth = Math.max(depth.get(nextId) || 0, (depth.get(nodeId) || 0) + 1);
              depth.set(nextId, nextDepth);
              indegree.set(nextId, (indegree.get(nextId) || 0) - 1);
              if ((indegree.get(nextId) || 0) <= 0) {
                queue.push(nextId);
              }
            });
          }

          if (visited.size < targets.length) {
            const fallbackDepth = Math.max(...Array.from(depth.values())) + 1;
            targets.forEach((node, index) => {
              if (!visited.has(node.nodeId)) {
                depth.set(node.nodeId, fallbackDepth + index);
              }
            });
          }

          const layers = new Map<number, InfiniteCanvasNode[]>();
          targets.forEach((node) => {
            const layer = depth.get(node.nodeId) || 0;
            const list = layers.get(layer) || [];
            list.push(node);
            layers.set(layer, list);
          });

          const sortedLayers = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
          const minX = Math.min(...targets.map((node) => node.position.x));
          const minY = Math.min(...targets.map((node) => node.position.y));
          const maxWidth = Math.max(...targets.map((node) => node.width));
          const columnGap = maxWidth + 140;
          const rowGap = 72;

          sortedLayers.forEach(([layer, nodes]) => {
            const ordered = [...nodes].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
            let cursorY = minY;

            ordered.forEach((node) => {
              node.position.x = minX + layer * columnGap;
              node.position.y = cursorY;
              cursorY += node.height + rowGap;
              node.updatedAt = nowISO();
            });
          });
        }
      });
    },
    [mutateProject, project, pushUndoSnapshot, selectedNodeIds, toast],
  );

  const removeNodes = useCallback(
    (nodeIds: string[]) => {
      if (!project || nodeIds.length === 0) return;
      pushUndoSnapshot();

      const removeSet = new Set(nodeIds);
      removeSet.forEach((nodeId) => {
        const controller = abortControllersRef.current.get(nodeId);
        if (controller) {
          controller.abort();
          abortControllersRef.current.delete(nodeId);
        }
        const timerId = progressTimersRef.current.get(nodeId);
        if (timerId !== undefined) {
          window.clearInterval(timerId);
          progressTimersRef.current.delete(nodeId);
        }
      });

      mutateProject((draft) => {
        draft.nodes = draft.nodes.filter((node) => !removeSet.has(node.nodeId));
        draft.edges = draft.edges.filter((edge) => !removeSet.has(edge.sourceNodeId) && !removeSet.has(edge.targetNodeId));
        draft.runQueue = draft.runQueue.filter((item) => !removeSet.has(item.nodeId));
      });

      setSelectedNodeIds([]);
      setConnectionSourceId((current) => (current && removeSet.has(current) ? null : current));
    },
    [mutateProject, project, pushUndoSnapshot],
  );

  const handleDragStart = useCallback(
    (nodeId: string, clientX: number, clientY: number) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;

      const activeIds = (selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]).filter((id) => {
        const target = currentProject.nodes.find((item) => item.nodeId === id);
        return !!target && !target.isLocked;
      });
      if (activeIds.length === 0) return;

      const startPositions: Record<string, { x: number; y: number }> = {};

      for (const id of activeIds) {
        const node = currentProject.nodes.find((item) => item.nodeId === id);
        if (node) {
          startPositions[id] = { ...node.position };
        }
      }

      pushUndoSnapshot();
      setSelectedNodeIds(activeIds);
      setSelectionRect(null);
      setDragGuides([]);
      interactionRef.current = {
        type: 'drag',
        startClient: { x: clientX, y: clientY },
        nodeIds: activeIds,
        startPositions,
        allNodes: currentProject.nodes.map((node) => ({
          nodeId: node.nodeId,
          width: node.width,
          height: node.height,
          position: { ...node.position },
          isLocked: node.isLocked,
        })),
      };
    },
    [pushUndoSnapshot, selectedNodeIds],
  );

  const handleCanvasPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      setContextMenu(null);
      const target = event.target as HTMLElement;
      if (target.closest('[data-panel]')) {
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pointerInCanvas = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (event.button === 1 || (event.button === 0 && isSpacePressedRef.current)) {
        const currentViewport = viewportRef.current;
        interactionRef.current = {
          type: 'pan',
          startClient: { x: event.clientX, y: event.clientY },
          startViewport: { x: currentViewport.x, y: currentViewport.y },
        };
        return;
      }

      if (event.button === 2) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const connectionTarget = findConnectionTargetCandidate(
        projectRef.current,
        connectionSourceId,
        pointerInCanvas,
        viewportRef.current,
      );
      if (connectionSourceId) {
        if (connectionTarget) {
          pushUndoSnapshot();
          mutateProject((draft) => {
            draft.edges.push({
              edgeId: createId(),
              sourceNodeId: connectionSourceId,
              targetNodeId: connectionTarget.nodeId,
              sourcePort: 'output',
              targetPort: 'input',
              createdAt: nowISO(),
            });
          });
        } else {
          pushUndoSnapshot();
          const newNodeId = createId();
          const currentViewport = viewportRef.current;
          mutateProject((draft) => {
            draft.nodes.push({
              nodeId: newNodeId,
              nodeType: 'image',
              title: '图片节点',
              position: {
                x: (pointerInCanvas.x - currentViewport.x) / currentViewport.scale,
                y: ((pointerInCanvas.y - currentViewport.y) / currentViewport.scale) - 60,
              },
              width: 320,
              height: 220,
              outputs: [],
              status: 'idle',
              isSelected: true,
              isLocked: false,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            });
            draft.edges.push({
              edgeId: createId(),
              sourceNodeId: connectionSourceId,
              targetNodeId: newNodeId,
              sourcePort: 'output',
              targetPort: 'input',
              createdAt: nowISO(),
            });
          });
          setSelectedNodeIds([newNodeId]);
        }
        setConnectionSourceId(null);
        return;
      }

      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const baseSelection = additive ? selectedNodeIds : [];

      if (!additive) {
        setSelectedNodeIds([]);
      }
      setConnectionSourceId(null);
      setDragGuides([]);

      interactionRef.current = {
        type: 'select',
        startClient: { x: event.clientX, y: event.clientY },
        currentClient: { x: event.clientX, y: event.clientY },
        additive,
        baseSelection,
      };
      setSelectionRect({
        x: pointerInCanvas.x,
        y: pointerInCanvas.y,
        width: 0,
        height: 0,
      });
    },
    [connectionSourceId, mutateProject, pushUndoSnapshot, selectedNodeIds],
  );

  const handleCanvasContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const createNodeFromMenu = useCallback(
    (type: 'text' | 'image' | 'gallery') => {
      if (!contextMenu || !project || !canvasRef.current) return;

      const world = viewportToWorld(contextMenu.x, contextMenu.y);
      pushUndoSnapshot();

      let node: InfiniteCanvasNode;
      if (type === 'text') {
        node = createTextNode(world.x, world.y);
      } else if (type === 'image') {
        node = createImageNode(world.x, world.y);
      } else {
        node = createGalleryNode(world.x, world.y);
      }

      mutateProject((draft) => {
        draft.nodes.push(node);
      });
      setSelectedNodeIds([node.nodeId]);
      setContextMenu(null);
    },
    [contextMenu, mutateProject, project, pushUndoSnapshot, viewportToWorld],
  );

  const handleWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - viewport.x) / viewport.scale;
    const worldY = (cursorY - viewport.y) / viewport.scale;

    const nextScale = event.deltaY < 0 ? viewport.scale * 1.08 : viewport.scale * 0.92;
    const clamped = Math.max(0.2, Math.min(2.4, nextScale));

    const nextViewport = {
      x: cursorX - worldX * clamped,
      y: cursorY - worldY * clamped,
      scale: clamped,
    };

    setViewport(nextViewport);
    markDirty();
  }, [markDirty, viewport]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];

    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-59), deepClone({ ...project, canvasViewport: viewport })]);
    setProject(deepClone(prev));
    setViewport({
      x: prev.canvasViewport?.x ?? 180,
      y: prev.canvasViewport?.y ?? 120,
      scale: prev.canvasViewport?.scale ?? 1,
    });
    setSelectedNodeIds([]);
    markDirty();
  }, [markDirty, project, undoStack, viewport]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];

    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-59), deepClone({ ...project, canvasViewport: viewport })]);
    setProject(deepClone(next));
    setViewport({
      x: next.canvasViewport?.x ?? 180,
      y: next.canvasViewport?.y ?? 120,
      scale: next.canvasViewport?.scale ?? 1,
    });
    setSelectedNodeIds([]);
    markDirty();
  }, [markDirty, project, redoStack, viewport]);

  const handleOutputPortClick = useCallback((nodeId: string) => {
    setConnectionSourceId((current) => (current === nodeId ? null : nodeId));
  }, []);

  const handleInputPortClick = useCallback(
    (targetNodeId: string) => {
      if (!project || !connectionSourceId) return;
      if (connectionSourceId === targetNodeId) {
        setConnectionSourceId(null);
        return;
      }

      const sourceNode = project.nodes.find((node) => node.nodeId === connectionSourceId);
      const targetNode = project.nodes.find((node) => node.nodeId === targetNodeId);

      if (!canConnect(sourceNode, targetNode)) {
        toast({ title: '连线无效', description: '当前节点类型不允许连接。', variant: 'destructive' });
        return;
      }

      const duplicate = project.edges.some(
        (edge) => edge.sourceNodeId === connectionSourceId && edge.targetNodeId === targetNodeId,
      );
      if (duplicate) {
        setConnectionSourceId(null);
        return;
      }

      if (createsCycle(project.edges, connectionSourceId, targetNodeId)) {
        toast({ title: '检测到循环依赖', description: '请调整节点连接关系。', variant: 'destructive' });
        return;
      }

      pushUndoSnapshot();
      mutateProject((draft) => {
        draft.edges.push({
          edgeId: createId(),
          sourceNodeId: connectionSourceId,
          targetNodeId,
          sourcePort: 'output',
          targetPort: 'input',
          createdAt: nowISO(),
        });
      });

      setConnectionSourceId(null);
    },
    [connectionSourceId, mutateProject, project, pushUndoSnapshot, toast],
  );

  const fitCanvas = useCallback(() => {
    if (!project || project.nodes.length === 0 || !canvasRef.current) return;

    const padding = 120;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of project.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    }

    const boundsWidth = maxX - minX + padding * 2;
    const boundsHeight = maxY - minY + padding * 2;
    const canvasWidth = canvasRef.current.clientWidth;
    const canvasHeight = canvasRef.current.clientHeight;

    const scale = Math.max(0.2, Math.min(2, Math.min(canvasWidth / boundsWidth, canvasHeight / boundsHeight)));
    const x = canvasWidth / 2 - (minX + (maxX - minX) / 2) * scale;
    const y = canvasHeight / 2 - (minY + (maxY - minY) / 2) * scale;

    setViewport({ x, y, scale });
    markDirty();
  }, [markDirty, project]);

  const createHistoryItem = useCallback((node: InfiniteCanvasNode, outputUrl: string): InfiniteCanvasHistoryItem => {
    return {
      historyId: createId(),
      nodeId: node.nodeId,
      outputType: 'image',
      outputUrl,
      promptSnapshot: node.prompt,
      modelSnapshot: node.modelId,
      createdAt: nowISO(),
      status: 'success',
    };
  }, []);

  const collectReferences = useCallback((currentProject: InfiniteCanvasProject, node: InfiniteCanvasNode) => {
    const incomingEdges = currentProject.edges.filter((edge) => edge.targetNodeId === node.nodeId);
    const textPrompts: string[] = [];
    const referenceImages: string[] = [];

    for (const edge of incomingEdges) {
      const sourceNode = currentProject.nodes.find((item) => item.nodeId === edge.sourceNodeId);
      if (!sourceNode) continue;

      if (sourceNode.nodeType === 'text' && sourceNode.prompt?.trim()) {
        textPrompts.push(sourceNode.prompt.trim());
      }

      if (sourceNode.nodeType === 'image') {
        const output = getNodeOutput(sourceNode);
        if (output?.outputType === 'image' && output.assetUrl) {
          referenceImages.push(output.assetUrl);
        }
      }
    }

    if (node.inputAssetId) {
      const asset = currentProject.assets.find((item) => item.assetId === node.inputAssetId);
      if (asset?.url) {
        referenceImages.push(asset.url);
      }
    }

    return {
      textPrompts,
      referenceImages: uniqueStrings(referenceImages),
    };
  }, []);

  const runSingleNode = useCallback(
    async (nodeId: string) => {
      const currentProject = project;
      if (!currentProject) return;

      const node = currentProject.nodes.find((item) => item.nodeId === nodeId);
      if (!node || node.isLocked) return;

      if (node.nodeType === 'text') {
        mutateProject((draft) => {
          const target = draft.nodes.find((item) => item.nodeId === nodeId);
          if (!target) return;
          target.status = target.prompt?.trim() ? 'success' : 'idle';
          target.outputs = target.prompt?.trim()
            ? [
              {
                outputId: createId(),
                outputType: 'text',
                textContent: target.prompt.trim(),
                createdAt: nowISO(),
              },
            ]
            : [];
          target.progress = undefined;
          target.etaSeconds = undefined;
          target.updatedAt = nowISO();
        });
        return;
      }

      const mergedPrompt = [node.prompt?.trim(), ...collectReferences(currentProject, node).textPrompts]
        .filter(Boolean)
        .join('\n')
        .trim();

      if (!mergedPrompt) {
        mutateProject((draft) => {
          const target = draft.nodes.find((item) => item.nodeId === nodeId);
          if (!target) return;
          target.status = 'error';
          target.errorMsg = '请先填写 Prompt';
          target.progress = undefined;
          target.etaSeconds = undefined;
        });
        return;
      }

      const references = collectReferences(currentProject, node).referenceImages;
      const queueId = createId();
      const startedAt = nowISO();
      const controller = new AbortController();
      const estimatedSeconds = estimateNodeRunSeconds(node, references.length);
      const startTs = Date.now();
      abortControllersRef.current.set(nodeId, controller);

      const existingTimer = progressTimersRef.current.get(nodeId);
      if (existingTimer !== undefined) {
        window.clearInterval(existingTimer);
        progressTimersRef.current.delete(nodeId);
      }

      mutateProject((draft) => {
        const target = draft.nodes.find((item) => item.nodeId === nodeId);
        if (!target) return;
        target.status = 'running';
        target.errorMsg = undefined;
        target.progress = 0.04;
        target.etaSeconds = estimatedSeconds;

        draft.runQueue.unshift({
          queueId,
          nodeId,
          nodeTitle: node.title,
          status: 'running',
          progress: 0.04,
          etaSeconds: estimatedSeconds,
          startedAt,
        });
      });

      const timerId = window.setInterval(() => {
        const elapsed = Math.max(0, (Date.now() - startTs) / 1000);
        const ratio = Math.min(1, elapsed / estimatedSeconds);
        const eased = 0.04 + (0.93 - 0.04) * (1 - Math.pow(1 - ratio, 1.8));
        const progress = Math.max(0.04, Math.min(0.93, eased));
        const etaSeconds = Math.max(1, Math.round(estimatedSeconds - elapsed));

        mutateProject(
          (draft) => {
            const target = draft.nodes.find((item) => item.nodeId === nodeId);
            if (!target || target.status !== 'running') return;
            target.progress = progress;
            target.etaSeconds = etaSeconds;

            const queueItem = draft.runQueue.find((item) => item.queueId === queueId);
            if (queueItem && queueItem.status === 'running') {
              queueItem.progress = progress;
              queueItem.etaSeconds = etaSeconds;
            }
          },
          { markDirty: false },
        );
      }, 700);
      progressTimersRef.current.set(nodeId, timerId);

      try {
        const response = await generateCanvasImage({
          model: node.modelId || 'gemini-3-pro-image-preview',
          prompt: mergedPrompt,
          aspectRatio: node.params?.aspectRatio,
          imageSize: node.params?.imageSize,
          batchSize: node.params?.batchSize,
          seed: node.params?.seed,
          referenceImages: references,
          signal: controller.signal,
        });

        if (cancelRunRef.current) {
          throw new DOMException('Cancelled', 'AbortError');
        }

        if (!response.images || response.images.length === 0) {
          throw new Error('模型未返回图像结果');
        }

        pushUndoSnapshot();
        mutateProject((draft) => {
          const source = draft.nodes.find((item) => item.nodeId === nodeId);
          if (!source) return;

          const outputs = response.images.map((imageUrl) => ({
            outputId: createId(),
            outputType: 'image' as const,
            assetUrl: imageUrl,
            thumbnailUrl: imageUrl,
            promptSnapshot: mergedPrompt,
            modelSnapshot: source.modelId,
            createdAt: nowISO(),
          }));

          source.status = 'success';
          source.outputs = outputs;
          source.progress = 1;
          source.etaSeconds = 0;
          source.updatedAt = nowISO();

          if (source.nodeType === 'gallery') {
            // Gallery 节点：将生成图片追加到 galleryImages，不创建新子节点
            source.galleryImages = [...(source.galleryImages ?? []), ...response.images];
            response.images.forEach((imageUrl) => {
              draft.history.unshift(createHistoryItem(source, imageUrl));
            });
          } else {
            // 普通 image 节点：为每张图片创建独立输出节点
            response.images.forEach((imageUrl, index) => {
              const generatedNode = createImageNode(
                source.position.x + source.width + 120 + index * 24,
                source.position.y + index * 28,
              );

              generatedNode.title = `${source.title} Output ${index + 1}`;
              generatedNode.prompt = mergedPrompt;
              generatedNode.status = 'success';
              generatedNode.modelId = source.modelId;
              generatedNode.outputs = [
                {
                  outputId: createId(),
                  outputType: 'image',
                  assetUrl: imageUrl,
                  thumbnailUrl: imageUrl,
                  promptSnapshot: mergedPrompt,
                  modelSnapshot: source.modelId,
                  createdAt: nowISO(),
                },
              ];

              draft.nodes.push(generatedNode);
              draft.edges.push({
                edgeId: createId(),
                sourceNodeId: source.nodeId,
                targetNodeId: generatedNode.nodeId,
                sourcePort: 'output',
                targetPort: 'input',
                createdAt: nowISO(),
              });
              draft.history.unshift(createHistoryItem(source, imageUrl));
            });
          }

          const queueItem = draft.runQueue.find((item) => item.queueId === queueId);
          if (queueItem) {
            queueItem.status = 'success';
            queueItem.progress = 1;
            queueItem.etaSeconds = 0;
            queueItem.endedAt = nowISO();
          }
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';

        mutateProject((draft) => {
          const target = draft.nodes.find((item) => item.nodeId === nodeId);
          if (!target) return;

          if (isAbort || cancelRunRef.current) {
            target.status = 'idle';
            target.errorMsg = '任务已取消';
          } else {
            target.status = 'error';
            target.errorMsg = error instanceof Error ? error.message : '生成失败';
          }
          target.progress = undefined;
          target.etaSeconds = undefined;

          const queueItem = draft.runQueue.find((item) => item.queueId === queueId);
          if (queueItem) {
            queueItem.status = isAbort || cancelRunRef.current ? 'cancelled' : 'failed';
            queueItem.errorMsg = error instanceof Error ? error.message : '生成失败';
            queueItem.progress = undefined;
            queueItem.etaSeconds = undefined;
            queueItem.endedAt = nowISO();
          }
        });
      } finally {
        const intervalId = progressTimersRef.current.get(nodeId);
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
          progressTimersRef.current.delete(nodeId);
        }
        abortControllersRef.current.delete(nodeId);
      }
    },
    [collectReferences, createHistoryItem, mutateProject, project, pushUndoSnapshot],
  );

  useEffect(() => {
    if (!pendingAutoRunNodeId || running || !project) return;
    if (!project.nodes.some((node) => node.nodeId === pendingAutoRunNodeId)) return;

    const targetNodeId = pendingAutoRunNodeId;
    setPendingAutoRunNodeId(null);
    void runSingleNode(targetNodeId);
  }, [pendingAutoRunNodeId, project, runSingleNode, running]);

  const runSelectedNodes = useCallback(async () => {
    if (!project) return;

    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : [];
    if (targetIds.length === 0) {
      toast({
        title: '请选择节点',
        description: '请先选中至少一个可运行节点。',
      });
      return;
    }

    setRunning(true);
    cancelRunRef.current = false;

    for (const nodeId of targetIds) {
      if (cancelRunRef.current) break;
      // eslint-disable-next-line no-await-in-loop
      await runSingleNode(nodeId);
    }

    setRunning(false);
    cancelRunRef.current = false;
  }, [project, runSingleNode, selectedNodeIds, toast]);

  const stopRunning = useCallback(() => {
    cancelRunRef.current = true;
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    progressTimersRef.current.forEach((timerId) => window.clearInterval(timerId));
    progressTimersRef.current.clear();
    setRunning(false);
  }, []);

  const uploadAssets = useCallback(
    async (files: FileList | null) => {
      if (!files || !project) return;
      pushUndoSnapshot();

      const nextAssets: InfiniteCanvasAsset[] = [];

      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });

        try {
          const path = await saveImageAsset(dataUrl, 'uploads');
          nextAssets.push({
            assetId: createId(),
            name: file.name,
            url: path,
            thumbnailUrl: path,
            createdAt: nowISO(),
          });
        } catch (error) {
          toast({
            title: '素材上传失败',
            description: error instanceof Error ? error.message : file.name,
            variant: 'destructive',
          });
        }
      }

      if (nextAssets.length > 0) {
        mutateProject((draft) => {
          draft.assets = [...nextAssets, ...draft.assets];
        });
      }
    },
    [mutateProject, project, pushUndoSnapshot, toast],
  );

  const insertAssetAsNode = useCallback(
    (asset: InfiniteCanvasAsset) => {
      if (!project || !canvasRef.current) return;

      pushUndoSnapshot();
      const center = computeViewportCenter(viewport, {
        width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight,
      });

      const node = createImageNode(center.x + 40, center.y + 30);
      node.title = asset.name;
      node.inputAssetId = asset.assetId;
      node.status = 'success';
      node.outputs = [
        {
          outputId: createId(),
          outputType: 'image',
          assetUrl: asset.url,
          thumbnailUrl: asset.thumbnailUrl || asset.url,
          createdAt: nowISO(),
        },
      ];

      mutateProject((draft) => {
        draft.nodes.push(node);
      });
      setSelectedNodeIds([node.nodeId]);
    },
    [mutateProject, project, pushUndoSnapshot, viewport],
  );

  const handleCanvasDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

      const files = Array.from(event.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (!files.length || !project) return;

      pushUndoSnapshot();
      const dropWorld = viewportToWorld(event.clientX, event.clientY);
      const newAssets: InfiniteCanvasAsset[] = [];
      const newNodes: InfiniteCanvasNode[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });

        try {
          const path = await saveImageAsset(dataUrl, 'uploads');
          const asset: InfiniteCanvasAsset = {
            assetId: createId(),
            name: file.name,
            url: path,
            thumbnailUrl: path,
            createdAt: nowISO(),
          };
          const node = createImageNode(
            dropWorld.x + i * 360,
            dropWorld.y,
          );
          node.title = file.name;
          node.inputAssetId = asset.assetId;
          node.status = 'success';
          node.outputs = [
            {
              outputId: createId(),
              outputType: 'image',
              assetUrl: path,
              thumbnailUrl: path,
              createdAt: nowISO(),
            },
          ];
          newAssets.push(asset);
          newNodes.push(node);
        } catch (error) {
          toast({
            title: '图片上传失败',
            description: error instanceof Error ? error.message : file.name,
            variant: 'destructive',
          });
        }
      }

      if (newNodes.length > 0) {
        mutateProject((draft) => {
          draft.assets.unshift(...newAssets);
          draft.nodes.push(...newNodes);
        });
        setSelectedNodeIds(newNodes.map((n) => n.nodeId));
      }
    },
    [mutateProject, project, pushUndoSnapshot, toast, viewportToWorld],
  );

  const insertHistoryAsNode = useCallback(
    (history: InfiniteCanvasHistoryItem) => {
      if (!history.outputUrl || !canvasRef.current || !project) return;

      pushUndoSnapshot();
      const center = computeViewportCenter(viewport, {
        width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight,
      });

      const node = createImageNode(center.x + 30, center.y + 30);
      node.title = 'History Output';
      node.status = 'success';
      node.prompt = history.promptSnapshot || '';
      node.modelId = history.modelSnapshot;
      node.outputs = [
        {
          outputId: createId(),
          outputType: 'image',
          assetUrl: history.outputUrl,
          thumbnailUrl: history.outputUrl,
          promptSnapshot: history.promptSnapshot,
          modelSnapshot: history.modelSnapshot,
          createdAt: nowISO(),
        },
      ];

      mutateProject((draft) => {
        draft.nodes.push(node);
      });
      setSelectedNodeIds([node.nodeId]);
    },
    [mutateProject, project, pushUndoSnapshot, viewport],
  );

  const handleNodeImageUpload = useCallback(
    async (nodeId: string, file: File) => {
      if (!project) return;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });

      try {
        const path = await saveImageAsset(dataUrl, 'uploads');
        const assetId = createId();
        const asset: InfiniteCanvasAsset = {
          assetId,
          name: file.name,
          url: path,
          thumbnailUrl: path,
          createdAt: nowISO(),
        };

        mutateProject((draft) => {
          draft.assets.unshift(asset);
          const node = draft.nodes.find((n) => n.nodeId === nodeId);
          if (node) {
            node.inputAssetId = assetId;
            node.outputs.push({
              outputId: createId(),
              outputType: 'image',
              assetUrl: path,
              thumbnailUrl: path,
              createdAt: nowISO(),
            });
            node.status = 'success';
          }
        });
        toast({ title: '图片上传成功' });
      } catch (error) {
        toast({
          title: '上传失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      }
    },
    [mutateProject, project, toast],
  );

  const openImageEditorForNode = useCallback((nodeId: string) => {
    if (!project) return;
    const node = project.nodes.find((item) => item.nodeId === nodeId);
    if (!node || node.nodeType !== 'image') return;

    const output = getNodeOutput(node);
    const outputImageUrl = output?.outputType === 'image' ? output.assetUrl : undefined;
    const assetImageUrl = node.inputAssetId
      ? project.assets.find((asset) => asset.assetId === node.inputAssetId)?.url
      : undefined;
    const imageUrl = outputImageUrl || assetImageUrl || '';

    if (!imageUrl) {
      toast({
        title: '无可编辑图片',
        description: '请先为当前节点提供输入图片或生成结果。',
        variant: 'destructive',
      });
      return;
    }

    setImageEditDialogState({
      open: true,
      sourceNodeId: node.nodeId,
      imageUrl,
      initialPrompt: node.prompt || '',
      initialSession: node.imageEditorSession,
    });
  }, [project, toast]);

  const handleConfirmImageEdit = useCallback(async (payload: ImageEditConfirmPayload) => {
    if (!project) return;

    const sourceNode = imageEditDialogState.sourceNodeId
      ? project.nodes.find((item) => item.nodeId === imageEditDialogState.sourceNodeId)
      : undefined;

    try {
      const savedPath = await saveImageAsset(payload.mergedImageDataUrl, 'uploads');
      const assetId = createId();
      const now = nowISO();
      const asset: InfiniteCanvasAsset = {
        assetId,
        name: `Edited-${new Date().toLocaleTimeString()}`,
        url: savedPath,
        thumbnailUrl: savedPath,
        createdAt: now,
      };

      const fallbackPosition = canvasRef.current
        ? computeViewportCenter(viewport, {
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        })
        : { x: 40, y: 40 };

      const position = sourceNode
        ? { x: sourceNode.position.x + sourceNode.width + 120, y: sourceNode.position.y + 20 }
        : { x: fallbackPosition.x + 30, y: fallbackPosition.y + 20 };

      const { node: editedNode, pendingAutoRunNodeId: nextAutoRunNodeId } = buildEditedImageNode({
        sourceNode,
        inputAssetId: assetId,
        prompt: payload.finalPrompt,
        position,
      });

      editedNode.imageEditorSession = payload.sessionSnapshot;

      pushUndoSnapshot();
      mutateProject((draft) => {
        draft.assets.unshift(asset);
        draft.nodes.push(editedNode);
        if (sourceNode) {
          draft.edges.push({
            edgeId: createId(),
            sourceNodeId: sourceNode.nodeId,
            targetNodeId: editedNode.nodeId,
            sourcePort: 'output',
            targetPort: 'input',
            createdAt: nowISO(),
          });
        }
      });

      setSelectedNodeIds([editedNode.nodeId]);
      setPendingAutoRunNodeId(nextAutoRunNodeId);
      setImageEditDialogState((previous) => ({ ...previous, open: false }));

      toast({
        title: '已创建新节点',
        description: '编辑结果已回填并将在落盘后自动运行。',
      });
    } catch (error) {
      toast({
        title: '创建编辑节点失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  }, [imageEditDialogState.sourceNodeId, mutateProject, project, pushUndoSnapshot, toast, viewport]);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();

      if (!file) return;

      event.preventDefault();

      if (selectedNodeIds.length === 1) {
        const node = projectRef.current?.nodes.find((n) => n.nodeId === selectedNodeIds[0]);
        if (node && node.nodeType === 'image' && !node.isLocked) {
          await handleNodeImageUpload(node.nodeId, file);
          return;
        }
      }

      if (!projectRef.current || !canvasRef.current) return;

      pushUndoSnapshot();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });

      try {
        const path = await saveImageAsset(dataUrl, 'uploads');
        const assetId = createId();
        const asset: InfiniteCanvasAsset = {
          assetId,
          name: file.name || 'Pasted Image',
          url: path,
          thumbnailUrl: path,
          createdAt: nowISO(),
        };

        let position = { x: 0, y: 0 };
        if (pointerPosition) {
          position = {
            x: (pointerPosition.x - viewport.x) / viewport.scale,
            y: (pointerPosition.y - viewport.y) / viewport.scale,
          };
        } else {
          position = computeViewportCenter(viewport, {
            width: canvasRef.current.clientWidth,
            height: canvasRef.current.clientHeight,
          });
        }

        const node = createImageNode(position.x, position.y);
        node.title = file.name || 'Pasted Image';
        node.inputAssetId = assetId;
        node.status = 'success';
        node.outputs = [
          {
            outputId: createId(),
            outputType: 'image',
            assetUrl: path,
            thumbnailUrl: path,
            createdAt: nowISO(),
          },
        ];

        mutateProject((draft) => {
          draft.assets.unshift(asset);
          draft.nodes.push(node);
        });
        setSelectedNodeIds([node.nodeId]);
        toast({ title: '图片粘贴成功' });
      } catch (error) {
        toast({
          title: '图片粘贴失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [
    handleNodeImageUpload,
    mutateProject,
    pointerPosition,
    pushUndoSnapshot,
    selectedNodeIds,
    toast,
    viewport,
  ]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const activeSession = interactionRef.current;
      if (!activeSession) return;
      const currentViewport = viewportRef.current;

      if (activeSession.type === 'pan') {
        const dx = event.clientX - activeSession.startClient.x;
        const dy = event.clientY - activeSession.startClient.y;
        setViewport({
          x: activeSession.startViewport.x + dx,
          y: activeSession.startViewport.y + dy,
          scale: currentViewport.scale,
        });
        return;
      }

      if (activeSession.type === 'select') {
        const rect = canvasRef.current?.getBoundingClientRect();
        const currentProject = projectRef.current;
        if (!rect || !currentProject) return;

        activeSession.currentClient = { x: event.clientX, y: event.clientY };
        const selection = {
          x: Math.min(activeSession.startClient.x, activeSession.currentClient.x) - rect.left,
          y: Math.min(activeSession.startClient.y, activeSession.currentClient.y) - rect.top,
          width: Math.abs(activeSession.startClient.x - activeSession.currentClient.x),
          height: Math.abs(activeSession.startClient.y - activeSession.currentClient.y),
        };
        setSelectionRect(selection);

        const hitNodeIds = currentProject.nodes
          .filter((node) => {
            const screen = worldToScreen(currentViewport, node.position);
            const nodeRect = {
              x: screen.x,
              y: screen.y,
              width: node.width * currentViewport.scale,
              height: node.height * currentViewport.scale,
            };
            return intersectsRect(selection, nodeRect);
          })
          .map((node) => node.nodeId);

        const nextSelected = activeSession.additive
          ? Array.from(new Set([...activeSession.baseSelection, ...hitNodeIds]))
          : hitNodeIds;
        const sorted = [...nextSelected].sort();
        setSelectedNodeIds((prev) => {
          if (prev.length === sorted.length) {
            const prevSorted = [...prev].sort();
            if (prevSorted.every((item, index) => item === sorted[index])) {
              return prev;
            }
          }
          return sorted;
        });
        return;
      }

      if (activeSession.type === 'drag') {
        const dx = (event.clientX - activeSession.startClient.x) / currentViewport.scale;
        const dy = (event.clientY - activeSession.startClient.y) / currentViewport.scale;
        dragOffsetRef.current = { dx, dy };

        // 直接操作节点 DOM，完全跳过 React 渲染
        const movingSet = new Set(activeSession.nodeIds);
        // 构建当前帧所有移动节点的最新位置（用于重算边线）
        const currentPositions = new Map<string, { x: number; y: number }>();
        for (const snap of activeSession.allNodes) {
          if (movingSet.has(snap.nodeId)) {
            const base = activeSession.startPositions[snap.nodeId];
            if (base) currentPositions.set(snap.nodeId, { x: base.x + dx, y: base.y + dy });
          } else {
            currentPositions.set(snap.nodeId, snap.position);
          }
        }

        for (const nodeId of activeSession.nodeIds) {
          const el = document.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
          if (!el) continue;
          const pos = currentPositions.get(nodeId);
          if (!pos) continue;
          el.style.left = `${pos.x}px`;
          el.style.top = `${pos.y}px`;
        }

        // 同步更新与移动节点相连的 SVG 边线
        const currentProject = projectRef.current;
        if (currentProject) {
          const vp = currentViewport;
          for (const edge of currentProject.edges) {
            const involvesMover = movingSet.has(edge.sourceNodeId) || movingSet.has(edge.targetNodeId);
            if (!involvesMover) continue;

            const srcSnap = activeSession.allNodes.find((n) => n.nodeId === edge.sourceNodeId);
            const tgtSnap = activeSession.allNodes.find((n) => n.nodeId === edge.targetNodeId);
            if (!srcSnap || !tgtSnap) continue;

            const srcPos = currentPositions.get(edge.sourceNodeId) ?? srcSnap.position;
            const tgtPos = currentPositions.get(edge.targetNodeId) ?? tgtSnap.position;

            const sourceScreen = worldToScreen(vp, { x: srcPos.x + srcSnap.width, y: srcPos.y + srcSnap.height / 2 });
            const targetScreen = worldToScreen(vp, { x: tgtPos.x, y: tgtPos.y + tgtSnap.height / 2 });
            const newPath = buildConnectionPath(sourceScreen, targetScreen);

            const pathEl = document.querySelector<SVGPathElement>(`[data-edge-id="${edge.edgeId}"]`);
            if (pathEl) pathEl.setAttribute('d', newPath);
          }
        }
      }
    };

    const onPointerUp = () => {
      const activeSession = interactionRef.current;
      if (!activeSession) return;

      interactionRef.current = null;
      setDragGuides([]);

      if (activeSession.type === 'select') {
        setSelectionRect(null);
        return;
      }

      if (activeSession.type === 'drag') {
        const { dx, dy } = dragOffsetRef.current;
        dragOffsetRef.current = { dx: 0, dy: 0 };

        if (dx !== 0 || dy !== 0) {
          // 移除手动清理 DOM style 的逻辑，交给 React 渲染覆盖
          // 这样可以避免清理后到 React 渲染前的闪烁，以及解决连续快速操作时的位置重置问题

          // 乐观更新 projectRef.current，确保后续立即触发的交互拿到最新位置
          if (projectRef.current) {
            const nextNodes = projectRef.current.nodes.map((n) => {
              if (activeSession.nodeIds.includes(n.nodeId)) {
                const base = activeSession.startPositions[n.nodeId];
                if (base && !n.isLocked) {
                  return {
                    ...n,
                    position: { x: base.x + dx, y: base.y + dy },
                    updatedAt: nowISO(),
                  };
                }
              }
              return n;
            });
            projectRef.current = { ...projectRef.current, nodes: nextNodes };
          }

          mutateProject(
            (draft) => {
              for (const nodeId of activeSession.nodeIds) {
                const node = draft.nodes.find((item) => item.nodeId === nodeId);
                if (!node || node.isLocked) continue;
                const base = activeSession.startPositions[nodeId];
                if (!base) continue;
                node.position = { x: base.x + dx, y: base.y + dy };
                node.updatedAt = nowISO();
              }
            },
            { markDirty: false },
          );
        }
      }

      markDirty();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [markDirty, mutateProject]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!project) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const meta = isMac ? event.metaKey : event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const inInput = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);

      if (!inInput && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          removeNodes(selectedNodeIds);
        }
      }

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      }

      if (meta && event.key.toLowerCase() === 'c' && !inInput) {
        event.preventDefault();
        const selectedSet = new Set(selectedNodeIds);
        const nodes = project.nodes.filter((node) => selectedSet.has(node.nodeId));
        if (nodes.length === 0) return;
        const nodeIdSet = new Set(nodes.map((node) => node.nodeId));
        const edges = project.edges.filter(
          (edge) => nodeIdSet.has(edge.sourceNodeId) && nodeIdSet.has(edge.targetNodeId),
        );
        clipboardRef.current = { nodes: deepClone(nodes), edges: deepClone(edges) };
      }

      if (meta && event.key.toLowerCase() === 'v' && !inInput) {
        if (!clipboardRef.current) return;
        event.preventDefault();

        pushUndoSnapshot();
        const mapping = new Map<string, string>();
        const now = nowISO();
        const copiedNodes = clipboardRef.current.nodes.map((node) => {
          const newId = createId();
          mapping.set(node.nodeId, newId);
          return {
            ...deepClone(node),
            nodeId: newId,
            title: `${node.title} Copy`,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            outputs: node.outputs.map((output) => ({
              ...output,
              outputId: createId(),
            })),
            createdAt: now,
            updatedAt: now,
          };
        });

        const copiedEdges = clipboardRef.current.edges
          .map((edge) => {
            const source = mapping.get(edge.sourceNodeId);
            const target = mapping.get(edge.targetNodeId);
            if (!source || !target) return null;
            return {
              ...edge,
              edgeId: createId(),
              sourceNodeId: source,
              targetNodeId: target,
              createdAt: now,
            };
          })
          .filter(Boolean) as InfiniteCanvasEdge[];

        mutateProject((draft) => {
          draft.nodes.push(...copiedNodes);
          draft.edges.push(...copiedEdges);
        });

        setSelectedNodeIds(copiedNodes.map((node) => node.nodeId));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    handleRedo,
    handleUndo,
    mutateProject,
    project,
    pushUndoSnapshot,
    removeNodes,
    selectedNodeIds,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inInput = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (inInput) return;
      if (event.code === 'Space') {
        isSpacePressedRef.current = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    const onBlur = () => {
      isSpacePressedRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const edgeLines = useMemo(() => {
    if (!project) return [];

    return project.edges
      .map((edge) => {
        const source = project.nodes.find((node) => node.nodeId === edge.sourceNodeId);
        const target = project.nodes.find((node) => node.nodeId === edge.targetNodeId);
        if (!source || !target) return null;

        const sourceWorld = { x: source.position.x + source.width, y: source.position.y + source.height / 2 };
        const targetWorld = { x: target.position.x, y: target.position.y + target.height / 2 };

        const sourceScreen = worldToScreen(viewport, sourceWorld);
        const targetScreen = worldToScreen(viewport, targetWorld);

        return {
          edge,
          path: buildConnectionPath(sourceScreen, targetScreen),
        };
      })
      .filter(Boolean) as Array<{ edge: InfiniteCanvasEdge; path: string }>;
  }, [project, viewport]);

  const snappedConnectionTarget = useMemo(
    () => findConnectionTargetCandidate(project, connectionSourceId, pointerPosition, viewport),
    [connectionSourceId, pointerPosition, project, viewport],
  );

  const draftConnectionPath = useMemo(() => {
    if (!project || !connectionSourceId || !pointerPosition) return null;

    const source = project.nodes.find((node) => node.nodeId === connectionSourceId);
    if (!source) return null;

    const sourcePoint = worldToScreen(viewport, {
      x: source.position.x + source.width,
      y: source.position.y + source.height / 2,
    });
    const targetPoint = snappedConnectionTarget?.point || pointerPosition;

    return buildConnectionPath(sourcePoint, targetPoint);
  }, [connectionSourceId, pointerPosition, project, snappedConnectionTarget, viewport]);

  if (loading || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#161616] text-zinc-500 dark:text-[#D9D9D9]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载项目中...
      </div>
    );
  }

  const selectedSet = new Set(selectedNodeIds);
  const projectSidebarLeft = 80;
  const projectSidebarWidth = 320;
  const panelGap = 16;
  const sidePanelLeft = projectSidebarLeft + (projectSidebarOpen ? projectSidebarWidth + panelGap : 0);
  const chromeLeft = sidePanelLeft + 4;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-[#161616] text-zinc-900 dark:text-[#D9D9D9] transition-colors">
      <aside className="absolute left-4 top-4 z-40 flex flex-col gap-2 rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-white/60 dark:bg-[#2C2D2F]/60 p-2 backdrop-blur-xl">
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-xl text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
          onClick={() => router.push('/playground')}
          title="返回主页"
        >
          <Home className="h-4 w-4" />
        </Button>

        <div className="h-px bg-zinc-200 dark:bg-[#4A4C4D]" />

        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-xl text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
          onClick={() => setProjectSidebarOpen((open) => !open)}
          title={projectSidebarOpen ? '收起项目侧栏' : '展开项目侧栏'}
        >
          {projectSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>

        <div className="h-px bg-zinc-200 dark:bg-[#4A4C4D]" />

        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-xl text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
          onClick={() => createNodeAtCenter('text')}
          title="创建 Text 节点"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-xl text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
          onClick={() => createNodeAtCenter('image')}
          title="创建 Image 节点"
        >
          <WandSparkles className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-xl text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
          onClick={() => {
            if (!project || !canvasRef.current) return;
            const center = computeViewportCenter(viewport, {
              width: canvasRef.current.clientWidth,
              height: canvasRef.current.clientHeight,
            });
            const offset = project.nodes.length * 14;
            const node = createGalleryNode(center.x + offset, center.y + offset);
            pushUndoSnapshot();
            mutateProject((draft) => { draft.nodes.push(node); });
            setSelectedNodeIds([node.nodeId]);
          }}
          title="创建 Gallery 多图节点"
        >
          <GalleryHorizontalEnd className="h-4 w-4" />
        </Button>

        <div className="h-px bg-zinc-200 dark:bg-[#4A4C4D]" />

        <Button
          size="icon"
          variant="ghost"
          className={cn('h-10 w-10 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]', activePanel === 'assets' ? 'bg-zinc-200 dark:bg-[#C8F88D]/20 text-zinc-900 dark:text-[#C8F88D]' : 'text-zinc-500 dark:text-[#A3A3A3]')}
          onClick={() => setActivePanel((panel) => (panel === 'assets' ? null : 'assets'))}
          title="资产面板"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={cn('h-10 w-10 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]', activePanel === 'history' ? 'bg-zinc-200 dark:bg-[#C8F88D]/20 text-zinc-900 dark:text-[#C8F88D]' : 'text-zinc-500 dark:text-[#A3A3A3]')}
          onClick={() => setActivePanel((panel) => (panel === 'history' ? null : 'history'))}
          title="历史记录"
        >
          <History className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={cn('h-10 w-10 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]', activePanel === 'flows' ? 'bg-zinc-200 dark:bg-[#C8F88D]/20 text-zinc-900 dark:text-[#C8F88D]' : 'text-zinc-500 dark:text-[#A3A3A3]')}
          onClick={() => setActivePanel((panel) => (panel === 'flows' ? null : 'flows'))}
          title="模板库"
        >
          <Layers className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={cn('h-10 w-10 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]', activePanel === 'queue' ? 'bg-zinc-200 dark:bg-[#C8F88D]/20 text-zinc-900 dark:text-[#C8F88D]' : 'text-zinc-500 dark:text-[#A3A3A3]')}
          onClick={() => setActivePanel((panel) => (panel === 'queue' ? null : 'queue'))}
          title="执行队列"
        >
          <CircleDashed className="h-4 w-4" />
        </Button>
      </aside>

      {projectSidebarOpen ? (
        <section
          data-panel
          className="absolute top-4 z-40 h-[calc(100%-2rem)] w-[320px] overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-white/80 dark:bg-[#2C2D2F]/80 backdrop-blur-xl shadow-lg"
          style={{ left: projectSidebarLeft }}
        >
          <InfiniteCanvasProjectSidebar
            activeProjectId={project.projectId}
            onSelectProject={handleSelectProject}
          />
        </section>
      ) : null}

      {activePanel ? (
        <section
          data-panel
          className="absolute top-4 z-40 h-[calc(100%-2rem)] w-[320px] overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-white/80 dark:bg-[#2C2D2F]/80 backdrop-blur-xl shadow-lg"
          style={{ left: sidePanelLeft }}
        >
          {activePanel === 'assets' ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#4A4C4D] px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">Assets</p>
                <Button size="sm" className="h-8 rounded-lg bg-zinc-900 text-white dark:bg-[#C8F88D] dark:text-[#0E0E0E] hover:opacity-90 transition-opacity" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />上传
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    uploadAssets(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {project.assets.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-transparent p-3 text-xs text-zinc-500 dark:text-[#737373]">暂无素材，上传后可一键插入画布。</p>
                ) : (
                  project.assets.map((asset) => (
                    <div key={asset.assetId} className="rounded-xl border border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#161616] p-2">
                      <div className="relative h-24 w-full overflow-hidden rounded-lg border border-zinc-100 dark:border-[#161616] bg-zinc-100 dark:bg-black/40">
                        <Image src={asset.thumbnailUrl || asset.url} alt={asset.name} fill sizes="300px" className="object-cover" unoptimized />
                      </div>
                      <p className="mt-2 truncate text-xs text-zinc-700 dark:text-[#D9D9D9]">{asset.name}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-7 w-full rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#2C2D2F] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
                        onClick={() => insertAssetAsNode(asset)}
                      >
                        插入画布
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activePanel === 'history' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-zinc-200 dark:border-[#4A4C4D] px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">Generation History</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {project.history.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-transparent p-3 text-xs text-zinc-500 dark:text-[#737373]">暂无历史生成结果。</p>
                ) : (
                  project.history.map((item) => (
                    <div key={item.historyId} className="rounded-xl border border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#161616] p-2">
                      {item.outputUrl ? (
                        <div className="relative h-24 w-full overflow-hidden rounded-lg border border-zinc-100 dark:border-[#161616] bg-zinc-100 dark:bg-black/40">
                          <Image src={item.outputUrl} alt="history" fill sizes="300px" className="object-cover" unoptimized />
                        </div>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-[11px] text-zinc-600 dark:text-[#A3A3A3]">{item.promptSnapshot || '无 Prompt 快照'}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-7 w-full rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#2C2D2F] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
                        onClick={() => insertHistoryAsNode(item)}
                      >
                        继续编辑
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activePanel === 'flows' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-zinc-200 dark:border-[#4A4C4D] px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">Flows Library</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs text-zinc-600 dark:text-[#A3A3A3]">
                <div className="rounded-lg border border-zinc-200 dark:border-[#C8F88D]/20 bg-zinc-100 dark:bg-[#C8F88D]/10 p-3">
                  <span className="text-zinc-700 dark:text-[#D9D9D9]">模板能力为 P1，当前提供快捷创建：</span>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-7 rounded-lg bg-zinc-900 text-white dark:bg-[#C8F88D] dark:text-[#0E0E0E] hover:opacity-90" onClick={() => createNodeAtCenter('text')}>
                      Text 模板
                    </Button>
                    <Button size="sm" className="h-7 rounded-lg bg-zinc-900 text-white dark:bg-[#C8F88D] dark:text-[#0E0E0E] hover:opacity-90" onClick={() => createNodeAtCenter('image')}>
                      Image 模板
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activePanel === 'queue' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-zinc-200 dark:border-[#4A4C4D] px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">Run Queue</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {project.runQueue.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-transparent p-3 text-xs text-zinc-500 dark:text-[#737373]">暂无任务。</p>
                ) : (
                  project.runQueue.map((item) => {
                    const progress = Math.max(0, Math.min(1, item.progress ?? (item.status === 'success' ? 1 : 0)));
                    const progressPercent = Math.round(progress * 100);
                    const showProgress = item.status === 'running' || item.status === 'success';

                    return (
                      <div key={item.queueId} className="rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#161616] p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-zinc-700 dark:text-[#D9D9D9]">{item.nodeTitle}</p>
                          <span className="rounded border border-zinc-200 dark:border-[#4A4C4D] px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:text-[#A3A3A3]">{item.status}</span>
                        </div>

                        {showProgress ? (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-[#A3A3A3]">
                              <span>{progressPercent}%</span>
                              <span>ETA {formatEtaLabel(item.etaSeconds)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-[#2C2D2F]">
                              <div
                                className="h-full rounded-full bg-zinc-700 dark:bg-[#C8F88D]"
                                style={{ width: `${Math.max(4, progressPercent)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {item.errorMsg ? <p className="mt-1 text-rose-500 dark:text-rose-400">{item.errorMsg}</p> : null}
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#2C2D2F] px-2 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
                            onClick={() => runSingleNode(item.nodeId)}
                          >
                            重试
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <header
        className="absolute right-4 top-4 z-30 flex items-center justify-between rounded-2xl px-4 py-3"
        style={{ left: chromeLeft }}
      >
        <div className="flex min-w-0  flex-1 items-center gap-3 ">
          <Input
            value={project.projectName}
            onChange={(event) => {
              const value = event.target.value;
              mutateProject((draft) => {
                draft.projectName = value;
              });
            }}
            onBlur={() => {
              mutateProject((draft) => {
                draft.projectName = sanitizeName(draft.projectName);
              });
            }}
            className="h-10 w-30 text-sm font-semibold border-none text-zinc-900 dark:text-[#D9D9D9] "
          />
          <span className="text-xs text-zinc-500 dark:text-[#737373]">{saving ? '保存中...' : `已保存 ${lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : '--'}`}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            Redo
          </Button>

          <Button size="sm" className="h-8 rounded-lg bg-zinc-900 text-white dark:bg-[#C8F88D] px-3 text-xs font-semibold dark:text-[#0E0E0E] hover:opacity-90 transition-opacity" onClick={runSelectedNodes} disabled={running}>
            {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            运行
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-3 text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
            onClick={stopRunning}
            disabled={!running}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />停止
          </Button>

          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]" onClick={() => setViewport((current) => ({ ...current, scale: Math.min(2.4, current.scale * 1.1) }))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]" onClick={() => setViewport((current) => ({ ...current, scale: Math.max(0.2, current.scale * 0.9) }))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={fitCanvas}>
            适配画布 ({Math.round(viewport.scale * 100)}%)
          </Button>
        </div>
      </header>

      <div className="absolute right-4 top-20 z-20 w-[300px] rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-white/80 dark:bg-[#2C2D2F]/80 p-4 backdrop-blur-xl shadow-lg">
        <div className="space-y-2 text-xs text-zinc-600 dark:text-[#A3A3A3]">
          <p className="text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">项目信息</p>
          <p>节点数：{project.nodes.length}</p>
          <p>连线数：{project.edges.length}</p>
          <p>历史输出：{project.history.length}</p>
          <p>当前选中：{selectedNodeIds.length}</p>
          <p className="rounded-lg border border-zinc-200 dark:border-[#C8F88D]/20 bg-zinc-100 dark:bg-[#C8F88D]/10 p-2 text-[11px] text-zinc-700 dark:text-[#C8F88D]">
            节点参数（模型、比例、尺寸、批量、Seed）请直接在节点卡片中修改。
          </p>
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-zinc-700 dark:text-[#D9D9D9]">对齐</p>
            <div className="grid grid-cols-3 gap-1">
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('left')} disabled={selectedNodeIds.length < 2}>左</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('hCenter')} disabled={selectedNodeIds.length < 2}>中</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('right')} disabled={selectedNodeIds.length < 2}>右</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('top')} disabled={selectedNodeIds.length < 2}>上</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('vCenter')} disabled={selectedNodeIds.length < 2}>中线</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('bottom')} disabled={selectedNodeIds.length < 2}>下</Button>
            </div>
            <p className="pt-1 text-[11px] text-zinc-700 dark:text-[#D9D9D9]">排列</p>
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('hDistribute')} disabled={selectedNodeIds.length < 3}>横向分布</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('vDistribute')} disabled={selectedNodeIds.length < 3}>纵向分布</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('tidy')} disabled={selectedNodeIds.length < 2}>网格整理</Button>
              <Button size="sm" variant="secondary" className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] px-1 text-[10px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]" onClick={() => alignSelectedNodes('topology')}>拓扑整理</Button>
            </div>
          </div>
          <div className="pt-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
              onClick={async () => {
                try {
                  const response = await createProject(`${project.projectName} 副本`);
                  await saveProject(response.project.projectId, {
                    ...deepClone(project),
                    projectId: response.project.projectId,
                    projectName: `${project.projectName} 副本`,
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  });
                  toast({ title: '复制成功', description: '已创建项目副本。' });
                } catch (error) {
                  toast({ title: '复制失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
                }
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />复制项目
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={cn('relative h-full w-full overflow-hidden', isDragOver && 'ring-2 ring-inset ring-blue-400/60')}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={(event) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasContextMenu}
        onWheel={handleWheelZoom}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          // 只有真正离开画布区域时才取消高亮（避免子元素触发 leave）
          if (!canvasRef.current?.contains(event.relatedTarget as Node)) {
            setIsDragOver(false);
          }
        }}
        onDrop={handleCanvasDrop}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:24px_24px]" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {edgeLines.map(({ edge, path }) => {
            const isProcessing = project.nodes.some(
              (n) => n.status === 'running' && (n.nodeId === edge.sourceNodeId || n.nodeId === edge.targetNodeId)
            );
            return (
              <path
                key={edge.edgeId}
                data-edge-id={edge.edgeId}
                d={path}
                fill="none"
                className={cn(
                  isProcessing
                    ? "stroke-amber-500 opacity-80 animate-[flow_1s_linear_infinite]"
                    : "stroke-[#0E0E0E] dark:stroke-[#737373] opacity-30 animate-[flow_4s_linear_infinite]"
                )}
                strokeWidth={isProcessing ? 3 : 2}
                strokeDasharray="6 6"
              />
            );
          })}
          {dragGuides.map((guide, index) => {
            if (guide.axis === 'x') {
              const start = worldToScreen(viewport, { x: guide.value, y: guide.start });
              const end = worldToScreen(viewport, { x: guide.value, y: guide.end });
              return (
                <line
                  key={`guide-x-${index}-${guide.value}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="stroke-[#C8F88D]"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              );
            }

            const start = worldToScreen(viewport, { x: guide.start, y: guide.value });
            const end = worldToScreen(viewport, { x: guide.end, y: guide.value });
            return (
              <line
                key={`guide-y-${index}-${guide.value}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className="stroke-[#C8F88D]"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            );
          })}
          {draftConnectionPath ? (
            <path d={draftConnectionPath} fill="none" className="stroke-[#C8F88D] dark:stroke-[#C8F88D]" strokeWidth={2} strokeDasharray="6 5" />
          ) : null}
          {snappedConnectionTarget ? (
            <circle
              cx={snappedConnectionTarget.point.x}
              cy={snappedConnectionTarget.point.y}
              r={8}
              className="fill-[#C8F88D]/20 stroke-[#C8F88D]"
              strokeWidth={2}
            />
          ) : null}
        </svg>

        {selectionRect ? (
          <div
            className="pointer-events-none absolute border border-[#C8F88D] bg-[#C8F88D]/15"
            style={{
              left: selectionRect.x,
              top: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        ) : null}

        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {project.nodes.map((node) => (
            <CanvasNodeCard
              key={node.nodeId}
              node={node}
              selected={selectedSet.has(node.nodeId)}
              isConnectionSource={connectionSourceId === node.nodeId}
              isConnectionTarget={snappedConnectionTarget?.nodeId === node.nodeId}
              onSelect={handleSelectNode}
              onDragStart={handleDragStart}
              onPromptChange={(nodeId, value) => updateNodeById(nodeId, { prompt: value })}
              onTitleChange={(nodeId, value) => updateNodeById(nodeId, { title: value })}
              onImageModelChange={(nodeId, modelId) =>
                updateImageNodeConfig(nodeId, { modelId })
              }
              onImageParamsChange={(nodeId, params) =>
                updateImageNodeConfig(nodeId, { params })
              }
              onRun={(nodeId) => runSingleNode(nodeId)}
              onDelete={(nodeId) => removeNodes([nodeId])}
              onToggleCollapse={toggleNodeCollapse}
              onEditImage={openImageEditorForNode}
              onInputPortClick={handleInputPortClick}
              onOutputPortClick={handleOutputPortClick}
              onGalleryImagesChange={(nodeId, images) =>
                mutateProject((draft) => {
                  const n = draft.nodes.find((item) => item.nodeId === nodeId);
                  if (n) n.galleryImages = images;
                })
              }
              onResize={(nodeId, width, height) =>
                mutateProject((draft) => {
                  const n = draft.nodes.find((item) => item.nodeId === nodeId);
                  if (n) { n.width = width; n.height = height; }
                })
              }
              onUploadImage={handleNodeImageUpload}
            />
          ))}
        </div>
      </div>

      <footer
        className="absolute bottom-4 z-20 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-[#4A4C4D] bg-white/60 dark:bg-[#2C2D2F]/60 px-3 py-2 text-xs text-zinc-600 dark:text-[#A3A3A3] backdrop-blur-xl shadow-sm"
        style={{ left: chromeLeft }}
      >
        <Save className="h-3.5 w-3.5" />
        自动保存已启用
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </footer>

      {contextMenu ? (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSelect={createNodeFromMenu}
        />
      ) : null}

      <ImageEditDialog
        open={imageEditDialogState.open}
        imageUrl={imageEditDialogState.imageUrl}
        initialPrompt={imageEditDialogState.initialPrompt}
        initialSession={imageEditDialogState.initialSession}
        onOpenChange={(open) => {
          setImageEditDialogState((previous) => ({
            ...previous,
            open,
          }));
        }}
        onConfirm={handleConfirmImageEdit}
      />
    </div>
  );
}
