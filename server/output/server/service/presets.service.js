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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresetsService = void 0;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
const PRESET_DIR = path_1.default.join(process.cwd(), 'public/preset');
let PresetsService = class PresetsService {
    presetModel;
    imageAssetModel;
    async listPresets() {
        try {
            let presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();
            // Migration check: if DB is empty, try to import from local files
            if (presets.length === 0) {
                await this.migrateFromFiles();
                presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();
            }
            return presets.map((p) => ({
                id: String(p._id),
                name: p.name,
                coverUrl: p.coverUrl || '',
                config: (p.config || {}),
                editConfig: p.editConfig,
                category: p.category,
                projectId: p.projectId,
                createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
                type: p.type,
            }));
        }
        catch (error) {
            console.error('Failed to fetch presets', error);
            throw new http_error_1.HttpError(500, 'Failed to fetch presets');
        }
    }
    async migrateFromFiles() {
        try {
            await promises_1.default.access(PRESET_DIR);
            const files = await promises_1.default.readdir(PRESET_DIR);
            const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'categories.json');
            console.log(`Starting migration of ${jsonFiles.length} presets from files...`);
            for (const file of jsonFiles) {
                try {
                    const id = path_1.default.basename(file, '.json');
                    const content = await promises_1.default.readFile(path_1.default.join(PRESET_DIR, file), 'utf-8');
                    const presetData = JSON.parse(content);
                    // Try to find matching image
                    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
                    let dataUrl = presetData.coverUrl;
                    for (const ext of imageExtensions) {
                        const imagePath = path_1.default.join(PRESET_DIR, `${id}${ext}`);
                        try {
                            await promises_1.default.access(imagePath);
                            const buffer = await promises_1.default.readFile(imagePath);
                            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                            dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
                            break;
                        }
                        catch { /* ignore */ }
                    }
                    await this.presetModel.updateOne({ _id: id }, {
                        name: presetData.name,
                        coverUrl: dataUrl,
                        coverData: dataUrl?.startsWith('data:') ? dataUrl : undefined,
                        config: presetData.config,
                        editConfig: presetData.editConfig,
                        category: presetData.category,
                        projectId: presetData.projectId,
                        type: presetData.type,
                        createdAt: presetData.createdAt || new Date().toISOString(),
                    }, { upsert: true });
                }
                catch (e) {
                    console.error(`Failed to migrate preset ${file}`, e);
                }
            }
        }
        catch {
            // Directory doesn't exist or other error, skip migration
        }
    }
    async savePresetFromFormData(formData) {
        try {
            const jsonStr = formData.get('json');
            const coverFile = formData.get('cover');
            if (!jsonStr) {
                throw new http_error_1.HttpError(400, 'Missing json data');
            }
            const presetData = JSON.parse(jsonStr);
            if (!presetData.id) {
                presetData.id = (0, crypto_1.randomUUID)();
            }
            const id = presetData.id;
            if (coverFile && coverFile.size && coverFile.size > 0) {
                const arrayBuffer = await coverFile.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = buffer.toString('base64');
                const dataUrl = `data:${coverFile.type || 'image/png'};base64,${base64}`;
                presetData.coverUrl = dataUrl;
            }
            // 如果客户端直接传了 URL (比如已经是 CDN 地址)，但不是 DataURL，也不是 local:
            // 则直接保存
            const formDataCoverUrl = formData.get('coverUrl');
            if (formDataCoverUrl && !formDataCoverUrl.startsWith('local:') && !formDataCoverUrl.startsWith('data:')) {
                presetData.coverUrl = formDataCoverUrl;
            }
            await this.presetModel.findOneAndUpdate({ _id: presetData.id }, {
                name: presetData.name,
                coverUrl: presetData.coverUrl,
                coverData: presetData.coverUrl?.startsWith('data:') ? presetData.coverUrl : undefined,
                config: presetData.config,
                editConfig: presetData.editConfig,
                category: presetData.category,
                projectId: presetData.projectId,
                type: presetData.type,
                createdAt: presetData.createdAt || new Date().toISOString(),
            }, { upsert: true, new: true });
            return presetData;
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Save preset error:', error);
            throw new http_error_1.HttpError(500, 'Failed to save preset');
        }
    }
    async deletePreset(id) {
        try {
            await this.presetModel.deleteOne({ _id: id });
            await this.imageAssetModel.deleteMany({ 'meta.presetId': id });
        }
        catch (error) {
            console.error('Failed to delete preset', error);
            throw new http_error_1.HttpError(500, 'Failed to delete preset');
        }
    }
};
exports.PresetsService = PresetsService;
__decorate([
    (0, gulux_1.Inject)(db_1.Preset),
    __metadata("design:type", Object)
], PresetsService.prototype, "presetModel", void 0);
__decorate([
    (0, gulux_1.Inject)(db_1.ImageAsset),
    __metadata("design:type", Object)
], PresetsService.prototype, "imageAssetModel", void 0);
exports.PresetsService = PresetsService = __decorate([
    (0, gulux_1.Injectable)()
], PresetsService);
