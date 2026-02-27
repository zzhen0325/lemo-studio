import { Database, Prop, getModelForClass, modelOptions, index } from '@gulux/gulux/typegoose';
import type { Ref } from '@gulux/gulux/typegoose';
// 移除未使用的类型导入以修复 ESLint 警告


@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class ImageAsset {
  @Prop({ required: true })
  public url!: string;

  @Prop({ required: true })
  public dir!: string;

  @Prop({ required: true })
  public fileName!: string;

  @Prop({ required: true })
  public region!: string;

  @Prop({ enum: ['generation', 'reference', 'dataset', 'upload'], required: true })
  public type!: 'generation' | 'reference' | 'dataset' | 'upload';

  @Prop()
  public projectId?: string;

  @Prop()
  public generationId?: string;

  @Prop({ type: () => Object })
  public meta?: Record<string, unknown>;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
@index({ createdAt: -1 }) // 为排序字段添加索引，避免内存超限
@index({ userId: 1, createdAt: -1 }) // 针对用户查询优化
@index({ projectId: 1, createdAt: -1 }) // 针对项目查询优化
export class Generation {
  @Prop()
  public status?: 'pending' | 'completed' | 'failed';


  @Prop()
  public progress?: number;

  @Prop()
  public progressStage?: string;

  @Prop()
  public userId?: string;

  @Prop()
  public projectId?: string;

  @Prop()
  public llmResponse?: string;

  @Prop({ ref: () => ImageAsset })
  public outputImageId?: Ref<ImageAsset>;

  @Prop({ ref: () => ImageAsset })
  public sourceImageId?: Ref<ImageAsset>;

  @Prop()
  public outputUrl?: string;

  @Prop({ type: () => Object })
  public config?: Record<string, unknown>;

  @Prop()
  public createdAt?: string;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true, _id: false } })
export class Preset {
  @Prop({ required: true })
  public _id!: string;

  @Prop({ required: true })
  public name!: string;

  @Prop()
  public coverUrl?: string;

  @Prop()
  public coverData?: string; // Base64 data for the cover image

  @Prop({ type: () => Object })
  public config?: Record<string, unknown>;

  @Prop({ type: () => Object })
  public editConfig?: Record<string, unknown>;

  @Prop()
  public category?: string;

  @Prop()
  public projectId?: string;

  @Prop()
  public type?: 'generation' | 'edit';

  @Prop()
  public createdAt?: string;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class PresetCategory {
  @Prop({ required: true, default: 'default', unique: true })
  public key!: string;

  @Prop({ type: () => [String], default: [] })
  public categories!: string[];
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true, _id: false } })
export class StyleStack {
  @Prop({ required: true })
  public _id!: string;

  @Prop({ required: true })
  public name!: string;

  @Prop({ required: true })
  public prompt!: string;

  @Prop({ type: () => [String], default: [] })
  public imagePaths!: string[];

  @Prop({ type: () => [String], default: [] })
  public previewUrls?: string[];

  @Prop()
  public collageImageUrl?: string;

  @Prop({ type: () => Object })
  public collageConfig?: Record<string, unknown>;

  public createdAt?: Date;
  public updatedAt?: Date;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class ToolPreset {
  @Prop({ required: true })
  public toolId!: string;

  @Prop({ required: true })
  public name!: string;

  @Prop({ type: () => Object })
  public values?: Record<string, unknown>;

  @Prop()
  public thumbnail?: string;

  @Prop()
  public timestamp?: number;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class DatasetEntry {
  @Prop({ required: true })
  public collectionName!: string;

  @Prop({ required: true })
  public fileName!: string;

  @Prop({ required: true })
  public url!: string;

  @Prop()
  public prompt?: string;

  @Prop()
  public promptZh?: string;

  @Prop()
  public promptEn?: string;

  @Prop()
  public systemPrompt?: string;

  @Prop()
  public order?: number;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class DatasetCollection {
  @Prop({ required: true, unique: true })
  public name!: string;

  @Prop()
  public systemPrompt?: string;

  @Prop({ type: () => [String], default: [] })
  public order?: string[];
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class Project {
  @Prop({ required: true })
  public name!: string;

  @Prop()
  public userId?: string;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: false } })
@index({ projectId: 1 }, { unique: true })
@index({ updatedAt: -1 })
export class InfiniteCanvasProject {
  @Prop({ required: true, unique: true })
  public projectId!: string;

  @Prop({ required: true })
  public projectName!: string;

  @Prop()
  public coverUrl?: string;

  @Prop({ required: true })
  public createdAt!: string;

  @Prop({ required: true })
  public updatedAt!: string;

  @Prop({ default: 0 })
  public nodeCount!: number;

  @Prop({ type: () => Object })
  public canvasViewport?: Record<string, unknown>;

  @Prop()
  public lastOpenedPanel?: string | null;

  @Prop({ type: () => [Object], default: [] })
  public nodes!: Record<string, unknown>[];

  @Prop({ type: () => [Object], default: [] })
  public edges!: Record<string, unknown>[];

  @Prop({ type: () => [Object], default: [] })
  public assets!: Record<string, unknown>[];

  @Prop({ type: () => [Object], default: [] })
  public history!: Record<string, unknown>[];

  @Prop({ type: () => [Object], default: [] })
  public runQueue!: Record<string, unknown>[];
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class User {
  @Prop({ required: true })
  public name!: string;

  @Prop()
  public avatar?: string;

  @Prop()
  public password?: string;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class ApiProvider {
  @Prop({ required: true })
  public id!: string;

  @Prop({ required: true })
  public name!: string;

  @Prop()
  public providerType?: string;

  @Prop()
  public apiKey?: string;

  @Prop()
  public baseURL?: string;

  @Prop({ type: () => [Object] })
  public models?: Record<string, unknown>[];

  @Prop({ default: true })
  public isEnabled?: boolean;

  @Prop()
  public createdAt?: string;

  @Prop()
  public updatedAt?: string;
}

@Database('default')
@modelOptions({ schemaOptions: { timestamps: true } })
export class ApiSettings {
  @Prop({ required: true, default: 'default', unique: true })
  public key!: string;

  @Prop({ type: () => Object })
  public settings?: Record<string, unknown>;
}

export const ImageAssetModel = getModelForClass(ImageAsset);
export const GenerationModel = getModelForClass(Generation);
export const PresetModel = getModelForClass(Preset);
export const PresetCategoryModel = getModelForClass(PresetCategory);
export const StyleStackModel = getModelForClass(StyleStack);
export const ToolPresetModel = getModelForClass(ToolPreset);
export const DatasetEntryModel = getModelForClass(DatasetEntry);
export const DatasetCollectionModel = getModelForClass(DatasetCollection);
export const ProjectModel = getModelForClass(Project);
export const InfiniteCanvasProjectModel = getModelForClass(InfiniteCanvasProject);
export const UserModel = getModelForClass(User);
export const ApiProviderModel = getModelForClass(ApiProvider);
export const ApiSettingsModel = getModelForClass(ApiSettings);
