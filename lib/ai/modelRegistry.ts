import { TextProvider, VisionProvider, ImageProvider, ModelConfig } from './types';
import { OpenAICompatibleProvider, GoogleGenAIProvider, BytedanceAfrProvider, DoubaoVisionProvider, CozeImageProvider, CozeChatVisionProvider, CozePromptProvider, CozeWorkflowImageProvider } from './providers';
import { REGISTRY } from './registry';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { APIProviderConfig } from '@/lib/api-config/types';
import { normalizeProviderConfigs } from '@/lib/model-center';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// 豆包视觉模型列表（使用 /api/v3/responses 端点）
const DOUBAO_VISION_MODELS = [
    'doubao-seed-2-0-lite-260215',
    'doubao-seed-2-0-pro-260215',
    'doubao-seed-1-8-251228',
    'doubao-1-8-pro',
    'doubao-1.5-vision'
];

const COZE_SEEDREAM_WORKFLOW_MODEL_ID = 'coze_seedream4_5';

type ProviderRuntimeConfig = Pick<APIProviderConfig, 'id' | 'apiKey' | 'baseURL' | 'providerType' | 'models' | 'isEnabled'>;

// 从providers.json读取配置
function readProvidersConfig(): ProviderRuntimeConfig[] {
    try {
        const configPath = path.join(__dirname, '../../data/api-config/providers.json');
        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content) as ProviderRuntimeConfig[];
        return normalizeProviderConfigs(parsed as APIProviderConfig[]) as ProviderRuntimeConfig[];
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
    'provider-coze': 'COZE_API_TOKEN',
    'provider-coze-seed': 'COZE_SEED_API_TOKEN',
    'provider-workflow-local': ''
};

// 根据modelId查找对应的provider配置
export function findProviderConfigForModel(
    modelId: string,
    providersInput?: ProviderRuntimeConfig[]
): { apiKey: string; baseURL?: string; providerType: string } | null {
    const providers = providersInput && providersInput.length > 0 ? providersInput : readProvidersConfig();

    for (const provider of providers) {
        if (!provider.isEnabled) continue;
        for (const model of (provider.models || [])) {
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
        if (modelId.startsWith('doubao-') && (provider.models || []).some(m => m.modelId.startsWith('doubao-'))) {
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
        if (modelId.startsWith('gemini-') && (provider.models || []).some(m => m.modelId.startsWith('gemini-'))) {
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

export function getGoogleApiKey(providersInput?: ProviderRuntimeConfig[]): string {
    const providers = providersInput && providersInput.length > 0 ? providersInput : readProvidersConfig();
    const googleProvider = providers.find((provider) => provider.id === 'provider-google' && provider.isEnabled);
    if (googleProvider?.apiKey) {
        return googleProvider.apiKey;
    }

    const config = findProviderConfigForModel('gemini-3-pro-image-preview', providers);
    return config?.apiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
}

export function getProvider(
    modelId: string,
    overrideConfig?: Partial<ModelConfig>,
    providersInput?: ProviderRuntimeConfig[]
): TextProvider | VisionProvider | ImageProvider {
    const providers = providersInput && providersInput.length > 0 ? providersInput : readProvidersConfig();
    // 优先从 providers 配置获取 key/baseURL
    const providerConfig = findProviderConfigForModel(modelId, providers);

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

        if (modelId.endsWith('.safetensors') || modelId.includes('safetensors')) {
            return {
                generateImage: async () => ({ images: [] })
            } as ImageProvider;
        }

        console.error(`[getProvider] Model not found in registry: ${modelId}`);
        throw new Error(`Model ${modelId} not found in registry`);
    }

    // 合并配置：优先使用providers.json中的配置
    const config: ModelConfig = {
        ...entry.defaultConfig,
        apiKey: providerConfig?.apiKey || entry.defaultConfig.apiKey,
        baseURL: providerConfig?.baseURL || entry.defaultConfig.baseURL,
        ...overrideConfig
    };

    if (entry.id === 'coze-prompt') {
        config.apiKey = process.env.COZE_PROMPT_API_TOKEN || config.apiKey || process.env.COZE_API_TOKEN;
        config.baseURL = process.env.COZE_PROMPT_RUN_URL || config.baseURL;
    }
    if (entry.id === COZE_SEEDREAM_WORKFLOW_MODEL_ID) {
        config.apiKey = process.env.COZE_SEED_API_TOKEN || config.apiKey;
        config.baseURL = process.env.COZE_SEED_RUN_URL || config.baseURL;
    }

    // Fallback: Try to load from environment variables if apiKey is missing
    if (!config.apiKey) {
        if (entry.id === COZE_SEEDREAM_WORKFLOW_MODEL_ID) {
            config.apiKey = process.env.COZE_SEED_API_TOKEN;
        } else if (entry.providerType === 'coze-image' || entry.providerType === 'coze-vision') {
            config.apiKey = process.env.COZE_API_TOKEN;
        } else if (entry.providerType === 'google-genai') {
            config.apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
        } else if (entry.providerType === 'openai-compatible' || config.providerId === 'deepseek') {
            config.apiKey = process.env.DEEPSEEK_API_KEY;
        }
        // Add more mappings as needed
    }

    if (entry.providerType !== 'bytedance-afr' && !config.apiKey) {
        throw new Error(`Missing API Key for model ${modelId} (Provider: ${entry.providerType})`);
    }

    if (entry.id === 'coze-prompt') {
        return new CozePromptProvider(config);
    }

    if (entry.providerType === 'google-genai') {
        return new GoogleGenAIProvider(config);
    } else if (entry.providerType === 'bytedance-afr') {
        return new BytedanceAfrProvider(config);
    } else if (entry.id === COZE_SEEDREAM_WORKFLOW_MODEL_ID) {
        return new CozeWorkflowImageProvider(config);
    } else if (entry.providerType === 'coze-image') {
        return new CozeImageProvider(config);
    } else if (entry.providerType === 'coze-vision') {
        return new CozeChatVisionProvider(config);
    } else {
        // 检查是否是豆包视觉模型
        if (DOUBAO_VISION_MODELS.some(vm => modelId.includes(vm))) {
            return new DoubaoVisionProvider(config);
        }
        return new OpenAICompatibleProvider(config);
    }
}
