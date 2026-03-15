export interface DatasetImage {
  id: string;
  url: string;
  prompt: string;
  promptZh?: string;
  promptEn?: string;
  filename: string;
  isOptimizing?: boolean;
  isTranslating?: boolean;
  width?: number;
  height?: number;
}

export type CropMode = 'center' | 'longest';
export type TranslateLang = 'en' | 'zh';
