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
exports.StylesService = void 0;
const crypto_1 = require("crypto");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
let StylesService = class StylesService {
    styleStackModel;
    async listStyles() {
        try {
            const styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
            return styles.map((s) => ({
                id: String(s._id),
                name: s.name,
                prompt: s.prompt,
                imagePaths: (s.imagePaths && s.imagePaths.length > 0
                    ? s.imagePaths
                    : s.previewUrls || []),
                collageImageUrl: s.collageImageUrl,
                collageConfig: s.collageConfig,
                updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()).toISOString(),
            }));
        }
        catch (error) {
            console.error('Failed to fetch styles', error);
            throw new http_error_1.HttpError(500, 'Failed to fetch styles');
        }
    }
    async saveStyle(styleData) {
        try {
            if (!styleData.id) {
                styleData.id = (0, crypto_1.randomUUID)();
            }
            const updatedAt = new Date();
            const doc = {
                name: styleData.name,
                prompt: styleData.prompt,
                imagePaths: styleData.imagePaths || [],
                previewUrls: styleData.imagePaths || [],
                updatedAt,
            };
            if (styleData.collageImageUrl !== undefined) {
                doc.collageImageUrl = styleData.collageImageUrl;
            }
            if (styleData.collageConfig !== undefined) {
                doc.collageConfig = styleData.collageConfig;
            }
            await this.styleStackModel.updateOne({ _id: styleData.id }, { $set: doc }, { upsert: true });
            return {
                ...styleData,
                id: styleData.id,
                updatedAt: updatedAt.toISOString(),
            };
        }
        catch (error) {
            console.error('Save style error:', error);
            throw new http_error_1.HttpError(500, 'Failed to save style');
        }
    }
    async deleteStyle(id) {
        try {
            await this.styleStackModel.deleteOne({ _id: id });
        }
        catch (error) {
            console.error('Failed to delete style', error);
            throw new http_error_1.HttpError(500, 'Failed to delete style');
        }
    }
};
exports.StylesService = StylesService;
__decorate([
    (0, gulux_1.Inject)(db_1.StyleStack),
    __metadata("design:type", Object)
], StylesService.prototype, "styleStackModel", void 0);
exports.StylesService = StylesService = __decorate([
    (0, gulux_1.Injectable)()
], StylesService);
