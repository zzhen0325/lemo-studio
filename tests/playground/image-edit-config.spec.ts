import { describe, expect, it } from 'vitest';

import { buildPlaygroundImageEditConfig } from '@/app/studio/playground/_lib/image-edit-config';
import type { ImageEditorSessionSnapshot } from '@/components/image-editor';

describe('buildPlaygroundImageEditConfig', () => {
  it('keeps edit history fields complete for edit confirmation payloads', () => {
    const sessionSnapshot: ImageEditorSessionSnapshot = {
      version: 1,
      imageWidth: 1440,
      imageHeight: 960,
      plainPrompt: 'retouch',
      annotations: [],
      strokes: [],
    };

    const result = buildPlaygroundImageEditConfig({
      currentEditConfig: {
        canvasJson: { nodes: [] },
        referenceImages: [{ id: 'ref-1', dataUrl: 'data:image/png;base64,ref', label: 'Image 1' }],
        originalImageUrl: 'https://example.com/original-old.png',
        annotations: [],
        backgroundColor: '#000000',
        canvasSize: { width: 512, height: 512 },
      },
      originalImageUrl: 'https://example.com/original-new.png',
      sessionSnapshot,
    });

    expect(result.canvasJson).toEqual({ nodes: [] });
    expect(result.referenceImages).toHaveLength(1);
    expect(result.originalImageUrl).toBe('https://example.com/original-new.png');
    expect(result.canvasSize).toEqual({ width: 1440, height: 960 });
    expect(result.imageEditorSession).toEqual(sessionSnapshot);
  });
});
