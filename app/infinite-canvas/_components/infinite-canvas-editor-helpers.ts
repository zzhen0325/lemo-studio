import type { ImageEditorSessionSnapshot } from '@/components/image-editor';
import type {
  InfiniteCanvasEdge,
  InfiniteCanvasNode,
  InfiniteCanvasProject,
} from '@/types/infinite-canvas';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface DragGuide {
  axis: 'x' | 'y';
  value: number;
  start: number;
  end: number;
}

export interface ConnectionTargetCandidate {
  nodeId: string;
  point: ScreenPoint;
  distance: number;
}

export interface DragSnapshotNode {
  nodeId: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  isLocked: boolean;
}

export type DragSession = {
  type: 'drag';
  startClient: ScreenPoint;
  nodeIds: string[];
  startPositions: Record<string, { x: number; y: number }>;
  allNodes: DragSnapshotNode[];
};

export type PanSession = {
  type: 'pan';
  startClient: ScreenPoint;
  startViewport: { x: number; y: number };
};

export type SelectSession = {
  type: 'select';
  startClient: ScreenPoint;
  currentClient: ScreenPoint;
  additive: boolean;
  baseSelection: string[];
};

export type InteractionSession = DragSession | PanSession | SelectSession;

export type AlignMode =
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

export interface InfiniteImageEditDialogState {
  open: boolean;
  sourceNodeId?: string;
  imageUrl: string;
  initialPrompt: string;
  initialSession?: ImageEditorSessionSnapshot;
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export const EDITOR_ICON_BUTTON_CLASS = "studio-icon-button h-10 w-10 rounded-xl";
export const EDITOR_SECONDARY_BUTTON_CLASS = "studio-secondary-button h-8 rounded-lg text-xs";
export const EDITOR_COMPACT_BUTTON_CLASS = "studio-secondary-button h-7 rounded-md px-1 text-[10px]";
export const EDITOR_SIDE_PANEL_CLASS = "studio-panel-glass absolute top-4 z-40 h-[calc(100%-2rem)] w-[320px] overflow-hidden rounded-2xl";

export function worldToScreen(viewport: CanvasViewport, point: { x: number; y: number }): ScreenPoint {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

export function sanitizeName(value: string) {
  const next = value.trim();
  if (!next) return '未命名项目';
  return next.slice(0, 50);
}

export function getNodeOutput(node: InfiniteCanvasNode) {
  return node.outputs[node.outputs.length - 1];
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildConnectionPath(source: ScreenPoint, target: ScreenPoint) {
  const handle = Math.max(60, Math.abs(target.x - source.x) * 0.4);
  return `M ${source.x} ${source.y} C ${source.x + handle} ${source.y}, ${target.x - handle} ${target.y}, ${target.x} ${target.y}`;
}

export function formatEtaLabel(seconds?: number) {
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

export function intersectsRect(
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

export function estimateNodeRunSeconds(node: InfiniteCanvasNode, referenceCount: number) {
  const batch = Math.max(1, node.params?.batchSize || 1);
  return Math.max(8, Math.round(12 + batch * 7 + referenceCount * 4));
}

export function findConnectionTargetCandidate(
  project: InfiniteCanvasProject | null,
  sourceNodeId: string | null,
  pointerPosition: ScreenPoint | null,
  viewport: CanvasViewport,
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

export function canConnect(source: InfiniteCanvasNode | undefined, target: InfiniteCanvasNode | undefined) {
  if (!source || !target) return false;
  if (source.nodeId === target.nodeId) return false;

  if (source.nodeType === 'text' && target.nodeType === 'image') return true;
  if (source.nodeType === 'text' && target.nodeType === 'text') return true;
  if (source.nodeType === 'image' && target.nodeType === 'image') return true;
  if (source.nodeType === 'image' && target.nodeType === 'text') return true;
  return false;
}

export function createsCycle(edges: InfiniteCanvasEdge[], sourceNodeId: string, targetNodeId: string) {
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
