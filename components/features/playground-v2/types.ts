export interface GenerationConfig {
  prompt: string;
  img_width: number;
  img_height: number;
  gen_num: number;
  base_model: string;
  image_size?: '1K' | '2K' | '4K';
  lora?: string;
  ref_image?: string;
}

export interface GenerationResult {
  id: string;
  imageUrl?: string;
  imageUrls?: string[];

  config?: GenerationConfig;
  metadata?: {
    prompt?: string;
    base_model?: string;
    img_width?: number;
    img_height?: number;
    lora?: string;
  };
  timestamp: string;
  prompt?: string;
  isLoading?: boolean;
  savedPath?: string;
  type?: 'image' | 'text';
  sourceImage?: string;
  projectId?: string;
}

export interface UploadedImage {
  file: File;
  base64: string;
  previewUrl: string;
  path?: string;
}

export interface Preset {
  id: string;
  title: string;
  cover: string; // Image URL
  prompt: string;
  base_model: string;
  width: number;
  height: number;
  image_size?: '1K' | '2K' | '4K';
}

export interface StyleStack {
  id: string;
  name: string;
  prompt: string;
  imagePaths: string[]; // 关联的图片路径列表
  updatedAt: string;
}
