import type { ImageEditorSessionSnapshot } from '@/components/image-editor';

export type InfiniteNodeType = 'text' | 'image';

export type InfiniteNodeStatus =
  | 'idle'
  | 'ready'
  | 'running'
  | 'success'
  | 'error'
  | 'locked';

export type InfiniteQueueStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface InfiniteCanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export interface InfiniteCanvasOutput {
  outputId: string;
  outputType: 'text' | 'image';
  assetUrl?: string;
  textContent?: string;
  thumbnailUrl?: string;
  promptSnapshot?: string;
  modelSnapshot?: string;
  createdAt: string;
}

export interface InfiniteCanvasNode {
  nodeId: string;
  nodeType: InfiniteNodeType;
  title: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  status: InfiniteNodeStatus;
  modelId?: string;
  prompt?: string;
  params?: {
    aspectRatio?: string;
    imageSize?: string;
    seed?: number;
    batchSize?: number;
  };
  progress?: number;
  etaSeconds?: number;
  isCollapsed?: boolean;
  expandedHeight?: number;
  imageEditorSession?: ImageEditorSessionSnapshot;
  inputAssetId?: string;
  outputs: InfiniteCanvasOutput[];
  errorMsg?: string;
  isLocked: boolean;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InfiniteCanvasEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort: string;
  targetPort: string;
  createdAt: string;
}

export interface InfiniteCanvasAsset {
  assetId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface InfiniteCanvasHistoryItem {
  historyId: string;
  nodeId: string;
  outputType: 'text' | 'image';
  outputUrl?: string;
  textContent?: string;
  promptSnapshot?: string;
  modelSnapshot?: string;
  createdAt: string;
  status: 'success' | 'failed';
  errorMsg?: string;
}

export interface InfiniteCanvasQueueItem {
  queueId: string;
  nodeId: string;
  nodeTitle: string;
  status: InfiniteQueueStatus;
  progress?: number;
  etaSeconds?: number;
  startedAt: string;
  endedAt?: string;
  errorMsg?: string;
}

export interface InfiniteCanvasProject {
  projectId: string;
  projectName: string;
  coverUrl?: string;
  updatedAt: string;
  createdAt: string;
  nodeCount: number;
  canvasViewport?: InfiniteCanvasViewport;
  lastOpenedPanel?: 'assets' | 'history' | 'flows' | 'queue' | null;
  nodes: InfiniteCanvasNode[];
  edges: InfiniteCanvasEdge[];
  assets: InfiniteCanvasAsset[];
  history: InfiniteCanvasHistoryItem[];
  runQueue: InfiniteCanvasQueueItem[];
}

export interface InfiniteCanvasProjectSummary {
  projectId: string;
  projectName: string;
  coverUrl?: string;
  updatedAt: string;
  createdAt: string;
  nodeCount: number;
  lastOutputPreview?: string;
}

export interface InfiniteCanvasStore {
  version: 1;
  projects: InfiniteCanvasProject[];
}
