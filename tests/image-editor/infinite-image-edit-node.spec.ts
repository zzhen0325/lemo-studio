import { describe, expect, it } from 'vitest';
import { buildEditedImageNode, INFINITE_DEFAULT_IMAGE_MODEL, INFINITE_DEFAULT_IMAGE_PARAMS } from '@/app/infinite-canvas/_lib/image-edit-node';
import { createImageNode } from '@/app/infinite-canvas/_lib/helpers';

describe('buildEditedImageNode', () => {
  it('inherits model and params from source node', () => {
    const source = createImageNode(100, 120);
    source.title = 'Source Node';
    source.modelId = 'flux_klein';
    source.params = {
      aspectRatio: '16:9',
      imageSize: '1344x768',
      batchSize: 2,
      seed: 12345,
    };

    const result = buildEditedImageNode({
      sourceNode: source,
      inputAssetId: 'asset-1',
      prompt: 'new prompt',
      position: { x: 480, y: 200 },
    });

    expect(result.node.modelId).toBe('flux_klein');
    expect(result.node.params).toMatchObject({
      aspectRatio: '16:9',
      imageSize: '1344x768',
      batchSize: 2,
      seed: 12345,
    });
  });

  it('returns pendingAutoRunNodeId matching the created node', () => {
    const result = buildEditedImageNode({
      inputAssetId: 'asset-2',
      prompt: 'auto run test',
      position: { x: 200, y: 260 },
    });

    expect(result.pendingAutoRunNodeId).toBe(result.node.nodeId);
  });

  it('falls back to default model/params when source node is missing', () => {
    const result = buildEditedImageNode({
      inputAssetId: 'asset-3',
      prompt: 'fallback test',
      position: { x: 60, y: 90 },
    });

    expect(result.node.modelId).toBe(INFINITE_DEFAULT_IMAGE_MODEL);
    expect(result.node.params).toEqual(INFINITE_DEFAULT_IMAGE_PARAMS);
  });

  it('applies explicit model and params overrides from image edit confirmation', () => {
    const result = buildEditedImageNode({
      inputAssetId: 'asset-4',
      prompt: 'edited prompt',
      position: { x: 80, y: 110 },
      modelId: 'coze_seedream4_5',
      params: {
        aspectRatio: '16:9',
        imageSize: '1344x768',
        batchSize: 4,
      },
    });

    expect(result.node.modelId).toBe('coze_seedream4_5');
    expect(result.node.params).toMatchObject({
      aspectRatio: '16:9',
      imageSize: '1344x768',
      batchSize: 4,
    });
  });
});
