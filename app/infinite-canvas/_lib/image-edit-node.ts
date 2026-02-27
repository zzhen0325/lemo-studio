import type { InfiniteCanvasNode } from '@/types/infinite-canvas';
import { createImageNode } from './helpers';

export const INFINITE_DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';

export const INFINITE_DEFAULT_IMAGE_PARAMS: NonNullable<InfiniteCanvasNode['params']> = {
  aspectRatio: '1:1',
  imageSize: '1024x1024',
  batchSize: 1,
};

interface BuildEditedImageNodeOptions {
  sourceNode?: InfiniteCanvasNode;
  inputAssetId: string;
  prompt: string;
  position: { x: number; y: number };
}

export interface BuildEditedImageNodeResult {
  node: InfiniteCanvasNode;
  pendingAutoRunNodeId: string;
}

export function buildEditedImageNode(options: BuildEditedImageNodeOptions): BuildEditedImageNodeResult {
  const node = createImageNode(options.position.x, options.position.y);
  const sourceNode = options.sourceNode;

  const inheritedModel = sourceNode?.nodeType === 'image'
    ? sourceNode.modelId || INFINITE_DEFAULT_IMAGE_MODEL
    : INFINITE_DEFAULT_IMAGE_MODEL;

  const inheritedParams = sourceNode?.nodeType === 'image'
    ? {
      ...INFINITE_DEFAULT_IMAGE_PARAMS,
      ...(sourceNode.params || {}),
    }
    : INFINITE_DEFAULT_IMAGE_PARAMS;

  node.title = sourceNode ? `${sourceNode.title} Edit` : 'Edited Image';
  node.prompt = options.prompt;
  node.inputAssetId = options.inputAssetId;
  node.modelId = inheritedModel;
  node.params = inheritedParams;

  return {
    node,
    pendingAutoRunNodeId: node.nodeId,
  };
}
