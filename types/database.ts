export type Resolution = '1K' | '2K' | '4K';
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
  | '21:9';
export type SizeFrom = 'ratioResolution' | 'custom';
export interface SelectedLora {
  model_name: string;
  strength: number;
}

export interface Project {
  id: string;
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
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  sizeFrom?: SizeFrom;
  sourceImageUrl?: string;
  presetName?: string;
}

export interface Generation {
  id: string;
  userId: string;
  projectId: string;
  outputUrl: string;
  config: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  sourceImageUrl?: string;
  createdAt: string;
}

export interface Preset {
  id: string;
  name: string;
  coverUrl: string;
  config: GenerationConfig;
  projectId?: string;
  createdAt: string;
}

export interface Style {
  id: string;
  name: string;
  prompt: string;
  previewUrls: string[];
  updatedAt: string;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
}
