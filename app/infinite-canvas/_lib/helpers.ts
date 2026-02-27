import type {
  InfiniteCanvasNode,
  InfiniteCanvasProject,
  InfiniteCanvasViewport,
} from '@/types/infinite-canvas';

export function nowISO() {
  return new Date().toISOString();
}

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseSize(imageSize?: string): { width: number; height: number } {
  if (!imageSize) {
    return { width: 1024, height: 1024 };
  }

  const [w, h] = imageSize.split('x').map((value) => Number(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1024, height: 1024 };
  }

  return { width: w, height: h };
}

export function computeViewportCenter(
  viewport: InfiniteCanvasViewport,
  containerRect: { width: number; height: number }
) {
  return {
    x: (containerRect.width / 2 - viewport.x) / viewport.scale,
    y: (containerRect.height / 2 - viewport.y) / viewport.scale,
  };
}

export function createTextNode(x: number, y: number): InfiniteCanvasNode {
  const timestamp = nowISO();
  return {
    nodeId: createId(),
    nodeType: 'text',
    title: 'Text Block',
    position: { x, y },
    width: 340,
    height: 240,
    status: 'idle',
    prompt: '',
    outputs: [],
    isLocked: false,
    isSelected: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createImageNode(x: number, y: number): InfiniteCanvasNode {
  const timestamp = nowISO();
  return {
    nodeId: createId(),
    nodeType: 'image',
    title: 'Image Block',
    position: { x, y },
    width: 340,
    height: 320,
    status: 'idle',
    prompt: '',
    modelId: 'gemini-3-pro-image-preview',
    params: {
      aspectRatio: '1:1',
      imageSize: '1024x1024',
      batchSize: 1,
    },
    outputs: [],
    isLocked: false,
    isSelected: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createEmptyProject(name?: string): InfiniteCanvasProject {
  const timestamp = nowISO();

  return {
    projectId: createId(),
    projectName: (name || '未命名项目').trim().slice(0, 50) || '未命名项目',
    createdAt: timestamp,
    updatedAt: timestamp,
    nodeCount: 0,
    canvasViewport: { x: 0, y: 0, scale: 1 },
    lastOpenedPanel: null,
    nodes: [],
    edges: [],
    assets: [],
    history: [],
    runQueue: [],
  };
}
