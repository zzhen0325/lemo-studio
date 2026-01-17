import { TextProvider, VisionProvider, ImageProvider, ModelConfig } from './types';
import { OpenAICompatibleProvider, GoogleGenAIProvider, BytedanceAfrProvider, DoubaoVisionProvider, CozeImageProvider } from './providers';
import { REGISTRY } from './registry';
import fs from 'fs';
import path from 'path';

// 豆包视觉模型列表（使用 /api/v3/responses 端点）
const DOUBAO_VISION_MODELS = [
    'doubao-seed-1-8-251228',
    'doubao-1-8-pro',
    'doubao-1.5-vision'
];

// 从providers.json读取配置
function readProvidersConfig(): { id: string; apiKey: string; baseURL?: string; providerType: string; models: { modelId: string }[]; isEnabled?: boolean }[] {
    try {
        const configPath = path.join(process.cwd(), 'data/api-config/providers.json');
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.warn('[modelRegistry] Failed to read providers.json:', error);
        return [];
    }
}

// Provider 类型到环境变量名的映射
const PROVIDER_ENV_MAP: Record<string, string> = {
    'provider-doubao': 'DOUBAO_API_KEY',
    'provider-deepseek': 'DEEPSEEK_API_KEY',
    'provider-google': 'GOOGLE_API_KEY',
    'provider-coze': 'COZE_API_TOKEN'
};

// 根据modelId查找对应的provider配置
function findProviderConfigForModel(modelId: string): { apiKey: string; baseURL?: string; providerType: string } | null {
    const providers = readProvidersConfig();
    
    for (const provider of providers) {
        if (!provider.isEnabled) continue;
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

export function getGoogleApiKey(): string {
    const config = findProviderConfigForModel('gemini-3-pro-image-preview');
    return config?.apiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
}

export function getProvider(modelId: string, overrideConfig?: Partial<ModelConfig>): TextProvider | VisionProvider | ImageProvider {
    // 优先从providers.json获取配置
    const providerConfig = findProviderConfigForModel(modelId);

    // 1. Find registry entry
    let entry = REGISTRY.find(r => r.id === modelId);

    if (!entry) {
        // Fallback: Check if it looks like a doubao model
        if (modelId.startsWith('doubao-')) {
            entry = REGISTRY.find(r => r.id === 'doubao-seed-1-6-251015');
            if (entry || providerConfig) {
                const config: ModelConfig = {
                    providerId: 'doubao',
                    modelId,
                    baseURL: providerConfig?.baseURL || entry?.defaultConfig.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
                    apiKey: providerConfig?.apiKey || entry?.defaultConfig.apiKey,
                    ...overrideConfig
                };
                if (DOUBAO_VISION_MODELS.some(vm => modelId.includes(vm))) {
                    return new DoubaoVisionProvider(config);
                }
                return new OpenAICompatibleProvider(config);
            }
        }
        // Fallback for Gemini
        if (modelId.startsWith('gemini-')) {
            entry = REGISTRY.find(r => r.providerType === 'google-genai');
            if (entry || providerConfig) {
                const config: ModelConfig = {
                    providerId: 'google',
                    modelId,
                    apiKey: providerConfig?.apiKey || entry?.defaultConfig.apiKey,
                    ...overrideConfig
                };
                return new GoogleGenAIProvider(config);
            }
        }

        throw new Error(`Model ${modelId} not found in registry`);
    }

    // 合并配置：优先使用providers.json中的配置
    const config: ModelConfig = {
        ...entry.defaultConfig,
        apiKey: providerConfig?.apiKey || entry.defaultConfig.apiKey,
        baseURL: providerConfig?.baseURL || entry.defaultConfig.baseURL,
        ...overrideConfig
    };

    if (entry.providerType !== 'bytedance-afr' && !config.apiKey) {
        throw new Error(`Missing API Key for model ${modelId} (Provider: ${entry.providerType})`);
    }

    if (entry.providerType === 'google-genai') {
        return new GoogleGenAIProvider(config);
    } else if (entry.providerType === 'bytedance-afr') {
        return new BytedanceAfrProvider(config);
    } else if (entry.providerType === 'coze-image') {
        return new CozeImageProvider(config);
    } else {
        // 检查是否是豆包视觉模型
        if (DOUBAO_VISION_MODELS.some(vm => modelId.includes(vm))) {
            return new DoubaoVisionProvider(config);
        }
        return new OpenAICompatibleProvider(config);
    }
}
