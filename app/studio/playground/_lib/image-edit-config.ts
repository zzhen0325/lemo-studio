import type { ImageEditorSessionSnapshot } from '@/components/image-editor';
import type { EditPresetConfig } from '@/lib/playground/types';

export function buildPlaygroundImageEditConfig({
  currentEditConfig,
  originalImageUrl,
  sessionSnapshot,
}: {
  currentEditConfig?: EditPresetConfig;
  originalImageUrl?: string;
  sessionSnapshot: ImageEditorSessionSnapshot;
}): EditPresetConfig {
  return {
    ...currentEditConfig,
    canvasJson: currentEditConfig?.canvasJson || {},
    referenceImages: currentEditConfig?.referenceImages || [],
    annotations: currentEditConfig?.annotations || [],
    backgroundColor: currentEditConfig?.backgroundColor || 'transparent',
    canvasSize: {
      width: sessionSnapshot.imageWidth,
      height: sessionSnapshot.imageHeight,
    },
    originalImageUrl: originalImageUrl || currentEditConfig?.originalImageUrl || '',
    imageEditorSession: sessionSnapshot,
  };
}
