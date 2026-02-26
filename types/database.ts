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

export interface BannerGenerationFields {
  mainTitle: string;
  subTitle: string;
  timeText: string;
  extraDesc: string;
}

export type BannerTextPositionType = 'mainTitle' | 'subTitle' | 'timeText' | 'custom';

export interface BannerTextPositionInstruction {
  id: string;
  label: string;
  type: BannerTextPositionType;
  x?: number;
  y?: number;
  note?: string;
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
  baseModel?: string; // Real base model ID
  loras?: SelectedLora[];
  seed?: number;
  imageSize?: ImageSize;
  aspectRatio?: AspectRatio;
  sizeFrom?: SizeFrom;
  sourceImageUrls?: string[];
  localSourceIds?: string[]; // Track multiple local image IDs for sync
  presetName?: string; // Contains readable label (workflowName + loras summary)
  isPreset?: boolean; // Flag to indicate if the generation was from a preset
  editConfig?: EditPresetConfig;
  isEdit?: boolean;
  parentId?: string;
  taskId?: string;
  workflowName?: string;
  tldrawSnapshot?: Record<string, unknown>;
  generationMode?: 'playground' | 'banner';
  bannerTemplateId?: string;
  bannerFields?: BannerGenerationFields;
  bannerTextPositions?: BannerTextPositionInstruction[];
  bannerPromptFinal?: string;
  [key: string]: unknown;
}

export interface Generation {
  id: string;
  userId: string;
  projectId: string;
  outputUrl: string;
  config: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  llmResponse?: string;

  progress?: number;
  progressStage?: string;
  createdAt: string;
}


export interface AnnotationInfo {
  id: string;
  colorName: string;
  color: string;
  text: string;
  label: string;
  description?: string;
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
  tldrawSnapshot?: Record<string, unknown>;
  [key: string]: unknown;
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
  collageImageUrl?: string;
  collageConfig?: Record<string, unknown>;
  updatedAt: string;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
}
