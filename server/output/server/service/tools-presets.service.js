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
exports.ToolsPresetsService = void 0;
const crypto_1 = require("crypto");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
let ToolsPresetsService = class ToolsPresetsService {
    toolPresetModel;
    imageAssetModel;
    async listPresets(toolId) {
        try {
            const presets = await this.toolPresetModel.find({ toolId }).sort({ timestamp: -1 }).lean();
            return presets.map((p) => ({
                id: String(p._id),
                name: p.name,
                values: p.values,
                thumbnail: p.thumbnail || '',
                timestamp: p.timestamp || 0,
            }));
        }
        catch (error) {
            console.error('Failed to fetch tool presets', error);
            throw new http_error_1.HttpError(500, 'Failed to fetch presets');
        }
    }
    async savePresetFromFormData(formData) {
        try {
            const toolId = formData.get('toolId');
            const name = formData.get('name');
            const valuesStr = formData.get('values');
            const screenshot = formData.get('screenshot');
            const screenshotUrl = formData.get('screenshotUrl');
            if (!toolId || !name || !valuesStr) {
                throw new http_error_1.HttpError(400, 'Missing required fields');
            }
            const id = (0, crypto_1.randomUUID)();
            const timestamp = Date.now();
            const values = JSON.parse(valuesStr);
            let thumbnailPath = '';
            if (screenshotUrl) {
                thumbnailPath = screenshotUrl;
            }
            else if (screenshot) {
                const buffer = Buffer.from(await screenshot.arrayBuffer());
                const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
                thumbnailPath = dataUrl;
            }
            const preset = {
                id,
                name,
                values,
                thumbnail: thumbnailPath,
                timestamp,
            };
            await this.toolPresetModel.updateOne({ _id: id }, { toolId, name, values, thumbnail: thumbnailPath, timestamp }, { upsert: true });
            return preset;
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Save tool preset error:', error);
            throw new http_error_1.HttpError(500, 'Failed to save preset');
        }
    }
    async deletePreset(toolId, id) {
        try {
            await this.toolPresetModel.deleteOne({ _id: id, toolId });
            await this.imageAssetModel.deleteMany({ 'meta.presetId': id, 'meta.toolId': toolId });
        }
        catch (error) {
            console.error('Failed to delete preset', error);
            throw new http_error_1.HttpError(500, 'Failed to delete preset');
        }
    }
};
exports.ToolsPresetsService = ToolsPresetsService;
__decorate([
    (0, gulux_1.Inject)(db_1.ToolPreset),
    __metadata("design:type", Object)
], ToolsPresetsService.prototype, "toolPresetModel", void 0);
__decorate([
    (0, gulux_1.Inject)(db_1.ImageAsset),
    __metadata("design:type", Object)
], ToolsPresetsService.prototype, "imageAssetModel", void 0);
exports.ToolsPresetsService = ToolsPresetsService = __decorate([
    (0, gulux_1.Injectable)()
], ToolsPresetsService);
