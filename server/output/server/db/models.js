"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSettingsModel = exports.ApiProviderModel = exports.UserModel = exports.ProjectModel = exports.DatasetCollectionModel = exports.DatasetEntryModel = exports.ToolPresetModel = exports.StyleStackModel = exports.PresetCategoryModel = exports.PresetModel = exports.GenerationModel = exports.ImageAssetModel = exports.ApiSettings = exports.ApiProvider = exports.User = exports.Project = exports.DatasetCollection = exports.DatasetEntry = exports.ToolPreset = exports.StyleStack = exports.PresetCategory = exports.Preset = exports.Generation = exports.ImageAsset = void 0;
const typegoose_1 = require("@gulux/gulux/typegoose");
// 移除未使用的类型导入以修复 ESLint 警告
let ImageAsset = class ImageAsset {
    url;
    dir;
    fileName;
    region;
    type;
    projectId;
    generationId;
    meta;
};
exports.ImageAsset = ImageAsset;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ImageAsset.prototype, "url", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ImageAsset.prototype, "dir", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ImageAsset.prototype, "fileName", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ImageAsset.prototype, "region", void 0);
__decorate([
    (0, typegoose_1.Prop)({ enum: ['generation', 'reference', 'dataset', 'upload'], required: true }),
    __metadata("design:type", String)
], ImageAsset.prototype, "type", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ImageAsset.prototype, "projectId", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ImageAsset.prototype, "generationId", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], ImageAsset.prototype, "meta", void 0);
exports.ImageAsset = ImageAsset = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], ImageAsset);
let Generation = class Generation {
    status;
    progress;
    progressStage;
    userId;
    projectId;
    llmResponse;
    outputImageId;
    sourceImageId;
    outputUrl;
    config;
    createdAt;
};
exports.Generation = Generation;
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "status", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", Number)
], Generation.prototype, "progress", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "progressStage", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "userId", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "projectId", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "llmResponse", void 0);
__decorate([
    (0, typegoose_1.Prop)({ ref: () => ImageAsset }),
    __metadata("design:type", Object)
], Generation.prototype, "outputImageId", void 0);
__decorate([
    (0, typegoose_1.Prop)({ ref: () => ImageAsset }),
    __metadata("design:type", Object)
], Generation.prototype, "sourceImageId", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "outputUrl", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], Generation.prototype, "config", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Generation.prototype, "createdAt", void 0);
exports.Generation = Generation = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } }),
    (0, typegoose_1.index)({ createdAt: -1 }) // 为排序字段添加索引，避免内存超限
    ,
    (0, typegoose_1.index)({ userId: 1, createdAt: -1 }) // 针对用户查询优化
    ,
    (0, typegoose_1.index)({ projectId: 1, createdAt: -1 }) // 针对项目查询优化
], Generation);
let Preset = class Preset {
    _id;
    name;
    coverUrl;
    coverData; // Base64 data for the cover image
    config;
    editConfig;
    category;
    projectId;
    type;
    createdAt;
};
exports.Preset = Preset;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Preset.prototype, "_id", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Preset.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "coverUrl", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "coverData", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], Preset.prototype, "config", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], Preset.prototype, "editConfig", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "category", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "projectId", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "type", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Preset.prototype, "createdAt", void 0);
exports.Preset = Preset = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true, _id: false } })
], Preset);
let PresetCategory = class PresetCategory {
    key;
    categories;
};
exports.PresetCategory = PresetCategory;
__decorate([
    (0, typegoose_1.Prop)({ required: true, default: 'default', unique: true }),
    __metadata("design:type", String)
], PresetCategory.prototype, "key", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => [String], default: [] }),
    __metadata("design:type", Array)
], PresetCategory.prototype, "categories", void 0);
exports.PresetCategory = PresetCategory = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], PresetCategory);
let StyleStack = class StyleStack {
    _id;
    name;
    prompt;
    imagePaths;
    previewUrls;
    collageImageUrl;
    collageConfig;
    createdAt;
    updatedAt;
};
exports.StyleStack = StyleStack;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], StyleStack.prototype, "_id", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], StyleStack.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], StyleStack.prototype, "prompt", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => [String], default: [] }),
    __metadata("design:type", Array)
], StyleStack.prototype, "imagePaths", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => [String], default: [] }),
    __metadata("design:type", Array)
], StyleStack.prototype, "previewUrls", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], StyleStack.prototype, "collageImageUrl", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object }),
    __metadata("design:type", Object)
], StyleStack.prototype, "collageConfig", void 0);
exports.StyleStack = StyleStack = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true, _id: false } })
], StyleStack);
let ToolPreset = class ToolPreset {
    toolId;
    name;
    values;
    thumbnail;
    timestamp;
};
exports.ToolPreset = ToolPreset;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ToolPreset.prototype, "toolId", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ToolPreset.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], ToolPreset.prototype, "values", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ToolPreset.prototype, "thumbnail", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", Number)
], ToolPreset.prototype, "timestamp", void 0);
exports.ToolPreset = ToolPreset = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], ToolPreset);
let DatasetEntry = class DatasetEntry {
    collectionName;
    fileName;
    url;
    prompt;
    systemPrompt;
    order;
};
exports.DatasetEntry = DatasetEntry;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DatasetEntry.prototype, "collectionName", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DatasetEntry.prototype, "fileName", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DatasetEntry.prototype, "url", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], DatasetEntry.prototype, "prompt", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], DatasetEntry.prototype, "systemPrompt", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", Number)
], DatasetEntry.prototype, "order", void 0);
exports.DatasetEntry = DatasetEntry = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], DatasetEntry);
let DatasetCollection = class DatasetCollection {
    name;
    systemPrompt;
    order;
};
exports.DatasetCollection = DatasetCollection;
__decorate([
    (0, typegoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], DatasetCollection.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], DatasetCollection.prototype, "systemPrompt", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => [String], default: [] }),
    __metadata("design:type", Array)
], DatasetCollection.prototype, "order", void 0);
exports.DatasetCollection = DatasetCollection = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], DatasetCollection);
let Project = class Project {
    name;
    userId;
};
exports.Project = Project;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Project.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], Project.prototype, "userId", void 0);
exports.Project = Project = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], Project);
let User = class User {
    name;
    avatar;
    password;
};
exports.User = User;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "avatar", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
exports.User = User = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], User);
let ApiProvider = class ApiProvider {
    id;
    name;
    providerType;
    apiKey;
    baseURL;
    models;
    isEnabled;
    createdAt;
    updatedAt;
};
exports.ApiProvider = ApiProvider;
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ApiProvider.prototype, "id", void 0);
__decorate([
    (0, typegoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ApiProvider.prototype, "name", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ApiProvider.prototype, "providerType", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ApiProvider.prototype, "apiKey", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ApiProvider.prototype, "baseURL", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => [Object] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Array)
], ApiProvider.prototype, "models", void 0);
__decorate([
    (0, typegoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ApiProvider.prototype, "isEnabled", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ApiProvider.prototype, "createdAt", void 0);
__decorate([
    (0, typegoose_1.Prop)(),
    __metadata("design:type", String)
], ApiProvider.prototype, "updatedAt", void 0);
exports.ApiProvider = ApiProvider = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], ApiProvider);
let ApiSettings = class ApiSettings {
    key;
    settings;
};
exports.ApiSettings = ApiSettings;
__decorate([
    (0, typegoose_1.Prop)({ required: true, default: 'default', unique: true }),
    __metadata("design:type", String)
], ApiSettings.prototype, "key", void 0);
__decorate([
    (0, typegoose_1.Prop)({ type: () => Object })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ,
    __metadata("design:type", Object)
], ApiSettings.prototype, "settings", void 0);
exports.ApiSettings = ApiSettings = __decorate([
    (0, typegoose_1.Database)('default'),
    (0, typegoose_1.modelOptions)({ schemaOptions: { timestamps: true } })
], ApiSettings);
exports.ImageAssetModel = (0, typegoose_1.getModelForClass)(ImageAsset);
exports.GenerationModel = (0, typegoose_1.getModelForClass)(Generation);
exports.PresetModel = (0, typegoose_1.getModelForClass)(Preset);
exports.PresetCategoryModel = (0, typegoose_1.getModelForClass)(PresetCategory);
exports.StyleStackModel = (0, typegoose_1.getModelForClass)(StyleStack);
exports.ToolPresetModel = (0, typegoose_1.getModelForClass)(ToolPreset);
exports.DatasetEntryModel = (0, typegoose_1.getModelForClass)(DatasetEntry);
exports.DatasetCollectionModel = (0, typegoose_1.getModelForClass)(DatasetCollection);
exports.ProjectModel = (0, typegoose_1.getModelForClass)(Project);
exports.UserModel = (0, typegoose_1.getModelForClass)(User);
exports.ApiProviderModel = (0, typegoose_1.getModelForClass)(ApiProvider);
exports.ApiSettingsModel = (0, typegoose_1.getModelForClass)(ApiSettings);
