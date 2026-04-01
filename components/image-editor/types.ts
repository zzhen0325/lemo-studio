export type ImageEditorTool = 'select' | 'annotate' | 'brush' | 'eraser' | 'crop';

export interface ImageEditorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEditorAnnotation extends ImageEditorRect {
  id: string;
  label: string;
  description: string;
  color?: string;
  referenceImageUrl?: string;
}

export type ImageEditorStrokePath = Array<Array<string | number>>;

export interface ImageEditorStroke {
  id: string;
  color: string;
  width: number;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  path: ImageEditorStrokePath;
}

export type ImageEditorCrop = ImageEditorRect;

export interface ImageEditorSessionSnapshot {
  version: 1;
  imageWidth: number;
  imageHeight: number;
  plainPrompt: string;
  annotations: ImageEditorAnnotation[];
  strokes: ImageEditorStroke[];
  crop?: ImageEditorCrop;
}

export interface ImageEditConfirmPayload {
  mergedImageDataUrl: string;
  plainPrompt: string;
  finalPrompt: string;
  regionInstructions: string;
  modelId: string;
  imageSize: string;
  aspectRatio?: string;
  batchSize: number;
  sessionSnapshot: ImageEditorSessionSnapshot;
}

export interface ImageEditDialogProps {
  open: boolean;
  imageUrl: string;
  initialPrompt?: string;
  initialSession?: ImageEditorSessionSnapshot;
  legacyTldrawSnapshot?: Record<string, unknown>;
  generationContext?: 'playground' | 'infinite-canvas';
  initialModelId?: string;
  initialImageSize?: string;
  initialAspectRatio?: string;
  initialBatchSize?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ImageEditConfirmPayload) => void | Promise<void>;
}
