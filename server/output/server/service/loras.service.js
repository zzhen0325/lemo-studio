"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LorasService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const errors_1 = require("../../app/models/errors");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const errorResponseFactory = new errors_1.ErrorResponseFactory();
let LorasService = class LorasService {
    async listLoras() {
        try {
            const lorasDir = node_path_1.default.join(process.cwd(), 'public', 'loras');
            const files = await promises_1.default.readdir(lorasDir);
            const metadataFiles = files.filter((file) => file.endsWith('.metadata.json'));
            const lorasData = [];
            for (const metadataFile of metadataFiles) {
                try {
                    const metadataPath = node_path_1.default.join(lorasDir, metadataFile);
                    const metadataContent = await promises_1.default.readFile(metadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataContent);
                    const modelName = metadataFile.replace('.metadata.json', '') + '.safetensors';
                    const webpFileName = metadataFile.replace('.metadata.json', '') + '.webp';
                    const webpFilePath = node_path_1.default.join(lorasDir, webpFileName);
                    let previewUrl = '';
                    if (await this.fileExists(webpFilePath)) {
                        previewUrl = `/loras/${webpFileName}`;
                    }
                    let trainedWords = [];
                    if (metadata.civitai && metadata.civitai.trainedWords) {
                        trainedWords = Array.isArray(metadata.civitai.trainedWords)
                            ? metadata.civitai.trainedWords
                            : [metadata.civitai.trainedWords];
                    }
                    const baseModel = typeof metadata.base_model === 'string' ? metadata.base_model : '';
                    lorasData.push({
                        model_name: modelName,
                        preview_url: previewUrl,
                        trainedWords,
                        base_model: baseModel,
                    });
                }
                catch (err) {
                    console.error(`处理文件 ${metadataFile} 时出错:`, err);
                }
            }
            return lorasData;
        }
        catch (error) {
            console.error('处理loras数据时出错:', error);
            const errorResponse = errorResponseFactory.getErrorResponse(error);
            throw new http_error_1.HttpError(500, errorResponse.errorMsg, errorResponse);
        }
    }
    async fileExists(filePath) {
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.LorasService = LorasService;
exports.LorasService = LorasService = __decorate([
    (0, gulux_1.Injectable)()
], LorasService);
