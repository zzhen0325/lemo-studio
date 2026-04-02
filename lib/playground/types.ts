import { Generation, GenerationConfig, Preset, EditPresetConfig, StyleStack } from '@/types/database';

export type { Generation, GenerationConfig, Preset, EditPresetConfig, StyleStack };
export type GenerationResult = Generation;

export interface UploadedImage {
  id?: string;
  localId?: string;
  file: File;
  base64: string;
  previewUrl: string;
  path?: string;
  isUploading?: boolean;
  width?: number;
  height?: number;
}

export interface SelectedLora {
  model_name: string;
  strength: number;
  preview_url?: string;
}

export interface PresetExtended extends Omit<Preset, 'coverUrl'> {
  category?: string;
  coverUrl?: string;
  cover?: string;
  title?: string;
}

export type SystemInstruction = string;

export const BASE_SYSTEM_INSTRUCTION: SystemInstruction = `
  # 角色
你是备受赞誉的提示词大师Lemo-prompt，专为AI绘图工具flux打造提示词。

## 技能
### 技能1: 理解用户意图
利用先进的自然语言处理技术，准确剖析用户输入自然语言背后的真实意图，精准定位用户对于图像生成的核心需求。在描述物品时，避免使用"各种""各类"等概称，要详细列出具体物品。若用户提供图片，你会精准描述图片中的内容信息与构图，并按照图片信息完善提示词。

### 2: 优化构图与细节
运用专业的构图知识和美学原理，自动为场景增添丰富且合理的细节，精心调整构图，显著提升生成图像的构图完整性、故事性和视觉吸引力。

### 技能3: 概念转化
熟练运用丰富的视觉语言库，将用户提出的抽象概念快速且准确地转化为可执行的视觉描述，让抽象想法能通过图像生动、直观地呈现。

## 输出格式
1. 仅输出完整提示词中文版本
2. 使用精炼且生动的语言表达
3. 文字控制在200字以内`;

export const VISION_DESCRIBE_SYSTEM_PROMPT: SystemInstruction = `## 角色
您是一位专业的AI图像标注员，专门为生成式AI模型创建高质量、精准的训练数据集。您的目标是使用自然语言准确、客观地描述图像。

## 任务
分析提供的图像，并生成 4 份内容侧重点略有不同的描述。

## 标注指南
1. **格式：**自然语言，80字左右。
2. **客观性：**仅描述图像中呈现的主要视觉内容。
3. **分段：**请一次性返回 4 个结果，每个结果之间使用 '|||' 作为分隔符。
4. **精确性：**使用精确的术语（例如，不要用“花”，而应使用“红玫瑰”；不要用“枪”，而应使用“AK-47”）。

仅返回中文结果

## 输出结构优先级
[主体] -> [动作/姿势] -> [服装] -> [背景] -> [文字信息]

注意：**除了 4 个描述内容及其之间的 '|||' 分隔符外，不要返回任何额外文字。**`;

export const VISION_DESCRIBE_SINGLE_SYSTEM_PROMPT: SystemInstruction = `## 角色
您是一位专业的AI图像标注员，专门为生成式AI模型创建高质量、精准的训练数据集。您的目标是使用自然语言准确、客观地描述图像。

## 任务
分析提供的图像，并生成 1 份中文描述。

## 标注指南
1. **格式：**自然语言，80字左右。
2. **客观性：**仅描述图像中呈现的主要视觉内容。
3. **精确性：**使用精确术语（例如，不要用“花”，而应使用“红玫瑰”；不要用“枪”，而应使用“AK-47”）。

## 输出结构优先级
[主体] -> [动作/姿势] -> [服装] -> [背景] -> [文字信息]

仅返回中文结果。

注意：**只返回 1 条描述，不要编号，不要分隔符，不要任何额外解释。**`;

export type BannerModelId = string;

export interface BannerFields {
  mainTitle: string;
  subTitle: string;
  timeText: string;
  extraDesc: string;
}

export interface BannerRegionInstruction {
  id: string;
  label: string;
  description: string;
  role?: 'mainTitle' | 'subTitle' | 'timeText' | 'custom';
  mode?: 'text' | 'region';
  name?: string;
  sourceText?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  referenceImageUrl?: string;
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

export interface BannerTemplateConfig {
  id: string;
  name: string;
  tags?: string[];
  thumbnailUrl: string;
  baseImageUrl: string;
  width: number;
  height: number;
  defaultModel: BannerModelId;
  allowedModels: BannerModelId[];
  defaultFields: BannerFields;
  promptTemplate: string;
}

export interface BannerModeActiveData {
  templateId: string;
  model: BannerModelId;
  fields: BannerFields;
  regions: BannerRegionInstruction[];
  textPositions: BannerTextPositionInstruction[];
  promptFinal: string;
  promptEdited: boolean;
  editorSnapshot?: Record<string, unknown>;
}
