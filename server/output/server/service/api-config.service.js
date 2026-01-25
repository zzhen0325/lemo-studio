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
exports.ApiConfigService = void 0;
const crypto_1 = require("crypto");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
// 默认设置
const DEFAULT_SETTINGS = {
    services: {
        imageGeneration: {
            binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
        },
        translate: {
            binding: { providerId: 'google-translate', modelId: 'google-translate-api' },
        },
        describe: {
            binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
            systemPrompt: '',
        },
        optimize: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-6-251015' },
            systemPrompt: '',
        },
    },
    comfyUrl: '',
};
let ApiConfigService = class ApiConfigService {
    apiProviderModel;
    apiSettingsModel;
    async getAll() {
        try {
            const fallbackDate = new Date().toISOString();
            const providersRaw = await this.apiProviderModel.find().lean();
            const providers = providersRaw.map((p) => ({
                id: p.id || String(p._id),
                name: p.name,
                providerType: p.providerType || 'openai-compatible',
                apiKey: p.apiKey || '',
                baseURL: p.baseURL,
                models: (p.models || []),
                isEnabled: p.isEnabled ?? true,
                createdAt: p.createdAt || fallbackDate,
                updatedAt: p.updatedAt || fallbackDate,
            }));
            const settingsDoc = await this.apiSettingsModel.findOne({ key: 'default' }).lean();
            const settings = settingsDoc?.settings || DEFAULT_SETTINGS;
            const maskedProviders = providers.map((p) => ({
                ...p,
                apiKey: p.apiKey ? `[MASKED:${p.apiKey.length}]` : '',
            }));
            return { providers: maskedProviders, settings };
        }
        catch (error) {
            console.error('Failed to read API config:', error);
            throw new http_error_1.HttpError(500, 'Failed to read API config');
        }
    }
    // body 结构与原 Next 路由保持一致：
    // - { action: 'updateSettings', settings }
    // - 或 Provider 对象，用于创建/更新 Provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handlePost(body) {
        try {
            const { action } = body;
            if (action === 'updateSettings') {
                const { settings } = body;
                await this.apiSettingsModel.updateOne({ key: 'default' }, { settings, key: 'default' }, { upsert: true });
                return { success: true, settings };
            }
            const providerData = body;
            const now = new Date().toISOString();
            if (providerData.id) {
                const existing = await this.apiProviderModel.findById(providerData.id);
                if (!existing) {
                    throw new http_error_1.HttpError(404, 'Provider not found');
                }
                const finalApiKey = providerData.apiKey && providerData.apiKey.startsWith('[MASKED:')
                    ? existing.apiKey
                    : providerData.apiKey;
                await this.apiProviderModel.updateOne({ _id: providerData.id }, {
                    id: providerData.id,
                    ...providerData,
                    apiKey: finalApiKey ?? existing.apiKey,
                    updatedAt: now,
                });
            }
            else {
                const newId = providerData.id || (0, crypto_1.randomUUID)();
                await this.apiProviderModel.create({
                    _id: newId,
                    id: newId,
                    name: providerData.name || 'Unnamed Provider',
                    providerType: providerData.providerType || 'openai-compatible',
                    apiKey: providerData.apiKey || '',
                    baseURL: providerData.baseURL,
                    models: providerData.models || [],
                    isEnabled: providerData.isEnabled ?? true,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            const providers = (await this.apiProviderModel.find().lean()).map((p) => ({
                id: p.id || String(p._id),
                name: p.name,
                providerType: p.providerType || 'openai-compatible',
                apiKey: p.apiKey || '',
                baseURL: p.baseURL,
                models: (p.models || []),
                isEnabled: p.isEnabled ?? true,
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString(),
            }));
            return { success: true, providers };
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Failed to save API config:', error);
            throw new http_error_1.HttpError(500, 'Failed to save API config');
        }
    }
    async deleteProvider(id) {
        try {
            const res = await this.apiProviderModel.deleteOne({ _id: id });
            if (res.deletedCount === 0) {
                throw new http_error_1.HttpError(404, 'Provider not found');
            }
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Failed to delete provider:', error);
            throw new http_error_1.HttpError(500, 'Failed to delete provider');
        }
    }
};
exports.ApiConfigService = ApiConfigService;
__decorate([
    (0, gulux_1.Inject)(db_1.ApiProvider),
    __metadata("design:type", Object)
], ApiConfigService.prototype, "apiProviderModel", void 0);
__decorate([
    (0, gulux_1.Inject)(db_1.ApiSettings),
    __metadata("design:type", Object)
], ApiConfigService.prototype, "apiSettingsModel", void 0);
exports.ApiConfigService = ApiConfigService = __decorate([
    (0, gulux_1.Injectable)()
], ApiConfigService);
