export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9'
  | 'auto';
export type SizeFrom = 'ratioImageSize' | 'custom';
export interface SelectedLora {
  model_name: string;
  strength: number;
}

export interface Project {
  id: string;
  userId?: string;
  name: string;
  createdAt: string;
}

export interface GenerationConfig {
  prompt: string;
  width: number;
  height: number;
  model: string;
  workflowName?: string;
  lora?: string;
  loras?: SelectedLora[];
  seed?: number;
  imageSize?: ImageSize;
  aspectRatio?: AspectRatio;
  sizeFrom?: SizeFrom;
  sourceImageUrl?: string;
  sourceImageUrls?: string[];
  localSourceId?: string; // Track local image ID for sync
  localSourceIds?: string[]; // Track multiple local image IDs for sync
  presetName?: string;
  editConfig?: EditPresetConfig;
  isEdit?: boolean;
  parentId?: string;
  taskId?: string;
}

export interface Generation {
  id: string;
  userId: string;
  projectId: string;
  outputUrl: string;
  config: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  sourceImageUrl?: string;
  sourceImageUrls?: string[];
  localSourceId?: string; // Track local image ID for sync
  localSourceIds?: string[]; // Track multiple local image IDs for sync
  editConfig?: EditPresetConfig;
  isEdit?: boolean;
  parentId?: string;
  llmResponse?: string;
  progress?: number;
  progressStage?: string;
  createdAt: string;
  taskId?: string;
}

export interface AnnotationInfo {
  colorName: string;
  text: string;
  referenceImageLabel?: string;
  annotationName: string;
}

export interface EditPresetConfig {
  canvasJson: Record<string, unknown>;
  referenceImages: { id: string; dataUrl: string; label: string }[];
  originalImageUrl: string;
  annotations: AnnotationInfo[];
  backgroundColor: string;
  canvasSize: { width: number; height: number };
}

export interface Preset {
  id: string;
  name: string;
  coverUrl: string;
  config: GenerationConfig;
  editConfig?: EditPresetConfig;
  category?: string;
  projectId?: string;
  createdAt: string;
  type?: 'generation' | 'edit';
  disableModelSelection?: boolean;
  disableImageUpload?: boolean;
}

export interface Style {
  id: string;
  name: string;
  prompt: string;
  previewUrls: string[];
  updatedAt: string;
}

export interface StyleStack {
  id: string;
  name: string;
  prompt: string;
  imagePaths: string[];
  updatedAt: string;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
}
