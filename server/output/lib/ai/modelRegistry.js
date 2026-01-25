"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleApiKey = getGoogleApiKey;
exports.getProvider = getProvider;
const providers_1 = require("./providers");
const registry_1 = require("./registry");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// 豆包视觉模型列表（使用 /api/v3/responses 端点）
const DOUBAO_VISION_MODELS = [
    'doubao-seed-1-8-251228',
    'doubao-1-8-pro',
    'doubao-1.5-vision'
];
// 从providers.json读取配置
function readProvidersConfig() {
    try {
        const configPath = path_1.default.join(process.cwd(), 'data/api-config/providers.json');
        const content = fs_1.default.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        console.warn('[modelRegistry] Failed to read providers.json:', error);
        return [];
    }
}
// Provider 类型到环境变量名的映射
const PROVIDER_ENV_MAP = {
    'provider-doubao': 'DOUBAO_API_KEY',
    'provider-deepseek': 'DEEPSEEK_API_KEY',
    'provider-google': 'GOOGLE_API_KEY',
    'provider-coze': 'COZE_API_TOKEN'
};
// 根据modelId查找对应的provider配置
function findProviderConfigForModel(modelId) {
    const providers = readProvidersConfig();
    for (const provider of providers) {
        if (!provider.isEnabled)
            continue;
        for (const model of provider.models) {
            if (model.modelId === modelId) {
                // 如果 providers.json 中没有 key，尝试从环境变量读取
                let apiKey = provider.apiKey;
                if (!apiKey && provider.id && PROVIDER_ENV_MAP[provider.id]) {
                    apiKey = process.env[PROVIDER_ENV_MAP[provider.id]] || '';
                }
                return {
                    apiKey: apiKey,
                    baseURL: provider.baseURL,
                    providerType: provider.providerType
                };
            }
        }
        // 模糊匹配：如果modelId以provider的模型前缀开头
        if (modelId.startsWith('doubao-') && provider.models.some(m => m.modelId.startsWith('doubao-'))) {
            let apiKey = provider.apiKey;
            if (!apiKey && PROVIDER_ENV_MAP['provider-doubao']) {
                apiKey = process.env.DOUBAO_API_KEY || '';
            }
            return {
                apiKey: apiKey,
                baseURL: provider.baseURL,
                providerType: provider.providerType
            };
        }
        if (modelId.startsWith('gemini-') && provider.models.some(m => m.modelId.startsWith('gemini-'))) {
            let apiKey = provider.apiKey;
            if (!apiKey && PROVIDER_ENV_MAP['provider-google']) {
                apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
            }
            return {
                apiKey: apiKey,
                baseURL: provider.baseURL,
                providerType: provider.providerType
            };
        }
    }
    return null;
}
function getGoogleApiKey() {
    const config = findProviderConfigForModel('gemini-3-pro-image-preview');
    return config?.apiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
}
function getProvider(modelId, overrideConfig) {
    // 优先从providers.json获取配置
    const providerConfig = findProviderConfigForModel(modelId);
    // 1. Find registry entry
    let entry = registry_1.REGISTRY.find(r => r.id === modelId);
    if (!entry) {
        // Fallback: Check if it looks like a doubao model
        if (modelId.startsWith('doubao-')) {
            entry = registry_1.REGISTRY.find(r => r.id === 'doubao-seed-1-6-251015');
            if (entry || providerConfig) {
                const config = {
                    providerId: 'doubao',
                    modelId,
                    baseURL: providerConfig?.baseURL || entry?.defaultConfig.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
                    apiKey: providerConfig?.apiKey || entry?.defaultConfig.apiKey,
                    ...overrideConfig
                };
                if (DOUBAO_VISION_MODELS.some(vm => modelId.includes(vm))) {
                    return new providers_1.DoubaoVisionProvider(config);
                }
                return new providers_1.OpenAICompatibleProvider(config);
            }
        }
        // Fallback for Gemini
        if (modelId.startsWith('gemini-')) {
            entry = registry_1.REGISTRY.find(r => r.providerType === 'google-genai');
            if (entry || providerConfig) {
                const config = {
                    providerId: 'google',
                    modelId,
                    apiKey: providerConfig?.apiKey || entry?.defaultConfig.apiKey,
                    ...overrideConfig
                };
                return new providers_1.GoogleGenAIProvider(config);
            }
        }
        if (modelId.endsWith('.safetensors') || modelId.includes('safetensors')) {
            console.log(`[getProvider] Detected safetensors model: ${modelId}, returning dummy provider.`);
            return {
                generateImage: async () => ({ images: [] })
            };
        }
        console.error(`[getProvider] Model not found in registry: ${modelId}`);
        throw new Error(`Model ${modelId} not found in registry`);
    }
    // 合并配置：优先使用providers.json中的配置
    const config = {
        ...entry.defaultConfig,
        apiKey: providerConfig?.apiKey || entry.defaultConfig.apiKey,
        baseURL: providerConfig?.baseURL || entry.defaultConfig.baseURL,
        ...overrideConfig
    };
    if (entry.providerType !== 'bytedance-afr' && !config.apiKey) {
        throw new Error(`Missing API Key for model ${modelId} (Provider: ${entry.providerType})`);
    }
    if (entry.providerType === 'google-genai') {
        return new providers_1.GoogleGenAIProvider(config);
    }
    else if (entry.providerType === 'bytedance-afr') {
        return new providers_1.BytedanceAfrProvider(config);
    }
    else if (entry.providerType === 'coze-image') {
        return new providers_1.CozeImageProvider(config);
    }
    else {
        // 检查是否是豆包视觉模型
        if (DOUBAO_VISION_MODELS.some(vm => modelId.includes(vm))) {
            return new providers_1.DoubaoVisionProvider(config);
        }
        return new providers_1.OpenAICompatibleProvider(config);
    }
}
