import { create } from 'zustand';
import {
    APIConfigSettings,
    APIProviderConfig,
    DefaultModelMatrix,
    ModelContext,
    ModelTask,
    ServiceBinding,
    ServiceConfig,
    ServiceType
} from '../api-config/types';
import { getApiBase } from "../api-base";
import { mergeBuiltinProviders } from '@/lib/api-config/builtins';
import { getModelById, normalizeProviderConfigs, selectModelsForContext } from '@/lib/model-center';

interface APIConfigState {
    providers: APIProviderConfig[];
    settings: APIConfigSettings;
    isLoading: boolean;
    error: string | null;
    fetchConfig: (force?: boolean) => Promise<void>;
    addProvider: (provider: Partial<APIProviderConfig>) => Promise<void>;
    updateProvider: (id: string, updates: Partial<APIProviderConfig>) => Promise<void>;
    removeProvider: (id: string) => Promise<void>;
    updateSettings: (settings: Partial<APIConfigSettings>) => Promise<void>;
    updateServiceConfig: (service: ServiceType, config: Partial<ServiceConfig>) => Promise<void>;
    importProvidersFromFile: () => Promise<void>;
    ensureBuiltinProviders: () => void;
    getEnabledProviders: () => APIProviderConfig[];
    getProviderById: (id: string) => APIProviderConfig | undefined;
    getModelsForTask: (task: 'text' | 'vision' | 'image') => { providerId: string; providerName: string; modelId: string; displayName: string }[];
    getModelsForContext: (context: ModelContext, requiredTask?: ModelTask) => { providerId: string; providerName: string; modelId: string; displayName: string }[];
    getModelEntryById: (modelId: string) => ReturnType<typeof getModelById> | undefined;
    getServiceConfig: (service: ServiceType) => ServiceConfig | undefined;
    _configLoading: boolean;
    _configLoaded: boolean;
}

const EMPTY_BINDING: ServiceBinding = { providerId: '', modelId: '' };

const MODEL_ID_MIGRATIONS: Record<string, string> = {
    seed4_2_lemo: 'seed4_v2_0226lemo',
};

function migrateModelId(modelId?: string): string {
    if (!modelId) return '';
    return MODEL_ID_MIGRATIONS[modelId] || modelId;
}

function migrateProviderModelIds(providers: APIProviderConfig[]): APIProviderConfig[] {
    return providers.map((provider) => ({
        ...provider,
        models: (provider.models || []).map((model) => ({
            ...model,
            modelId: migrateModelId(model.modelId),
        })),
    }));
}

const DEFAULT_TRANSLATE_SYSTEM_PROMPT = [
    'You are a professional prompt translation engine for text-to-image workflows.',
    'Translate only. Do not explain, annotate, or add extra content.',
    'Output language must strictly match the target language requested by user.',
    'Preserve original meaning, tone, structure, and detail density.',
    'Keep comma-separated tag style if the source uses tags.',
    'Keep placeholders, symbols, model params, lora tags, and proper nouns unchanged when appropriate.',
    'Return plain translated text only, without quotes or markdown.',
].join('\n');

const DEFAULT_SETTINGS: APIConfigSettings = {
    services: {
        imageGeneration: {
            binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' }
        },
        translate: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
            systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT
        },
        describe: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
            systemPrompt: `## 角色
您是一位专业的AI图像标注员，专门为生成式AI模型创建高质量、精准的训练数据集。您的目标是使用自然语言准确、客观地描述图像。

## 任务
分析提供的图像，并生成 4 份内容侧重点略有不同的描述。

## 标注指南
1. **格式：**自然语言，80字左右。
2. **客观性：**仅描述图像中呈现的主要视觉内容。
3. **分段：**请一次性返回 4 个结果，每个结果之间使用 '|||' 作为分隔符。
4. **精确性：**使用精确的术语（例如，不要用"花"，而应使用"红玫瑰"；不要用"枪"，而应使用"AK-47"）。

仅返回中文结果

## 输出结构优先级
[主体] -> [动作/姿势] -> [服装] -> [背景] -> [文字信息]

注意：**除了 4 个描述内容及其之间的 '|||' 分隔符外，不要返回任何额外文字。**`
        },
        optimize: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-8-251228' },
            systemPrompt: `# 角色
你是备受赞誉的提示词大师Lemo-prompt，专为AI绘图工具flux打造提示词。

## 技能
### 技能1: 理解用户意图
利用先进的自然语言处理技术，准确剖析用户输入自然语言背后的真实意图，精准定位用户对于图像生成的核心需求。在描述物品时，避免使用"各种""各类"等概称，要详细列出具体物品。若用户提供图片，你会精准描述图片中的内容信息与构图，并按照图片信息完善提示词。

### 技能2: 优化构图与细节
运用专业的构图知识和美学原理，自动为场景增添丰富且合理的细节，精心调整构图，显著提升生成图像的构图完整性、故事性和视觉吸引力。

### 技能3: 概念转化
熟练运用丰富的视觉语言库，将用户提出的抽象概念快速且准确地转化为可执行的视觉描述，让抽象想法能通过图像生动、直观地呈现。

## 输出格式
1. 仅输出完整提示词中文版本
2. 使用精炼且生动的语言表达
3. 文字控制在200字以内`
        },
        datasetLabel: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' }
        }
    },
    defaults: {
        text: {
            textToText: { binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' } },
            imageToText: { binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' } },
            videoToText: { binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' } },
        },
        image: {
            textToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
            imageToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
            imagesToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
        }
    },
    comfyUrl: ''
};

function normalizeProvidersWithBuiltins(providers: APIProviderConfig[]): APIProviderConfig[] {
    return normalizeProviderConfigs(migrateProviderModelIds(mergeBuiltinProviders(providers)));
}

function withBinding(input?: Partial<ServiceConfig>, fallback?: ServiceBinding): ServiceConfig {
    const fallbackBinding = fallback || EMPTY_BINDING;
    return {
        binding: {
            providerId: input?.binding?.providerId || fallbackBinding.providerId,
            modelId: migrateModelId(input?.binding?.modelId || fallbackBinding.modelId)
        },
        systemPrompt: input?.systemPrompt
    };
}

function buildDefaultsFromServices(services: APIConfigSettings['services']): DefaultModelMatrix {
    const optimizeBinding = services.optimize.binding;
    const describeBinding = services.describe.binding;
    const imageBinding = services.imageGeneration.binding;

    return {
        text: {
            textToText: { binding: optimizeBinding },
            imageToText: { binding: describeBinding },
            videoToText: { binding: describeBinding },
        },
        image: {
            textToImage: { binding: imageBinding },
            imageToImage: { binding: imageBinding },
            imagesToImage: { binding: imageBinding },
        }
    };
}

function resolveDefaults(
    incomingDefaults: APIConfigSettings['defaults'] | undefined,
    services: APIConfigSettings['services'],
): DefaultModelMatrix {
    const base = buildDefaultsFromServices(services);
    return {
        text: {
            textToText: withBinding(incomingDefaults?.text?.textToText, base.text.textToText.binding),
            imageToText: withBinding(incomingDefaults?.text?.imageToText, base.text.imageToText.binding),
            videoToText: withBinding(incomingDefaults?.text?.videoToText, base.text.videoToText.binding),
        },
        image: {
            textToImage: withBinding(incomingDefaults?.image?.textToImage, base.image.textToImage.binding),
            imageToImage: withBinding(incomingDefaults?.image?.imageToImage, base.image.imageToImage.binding),
            imagesToImage: withBinding(incomingDefaults?.image?.imagesToImage, base.image.imagesToImage.binding),
        }
    };
}

function normalizeSettings(data: Record<string, unknown>): APIConfigSettings {
    const oldBindings = data.serviceBindings as Record<string, ServiceBinding> | undefined;
    const incomingServices = data.services as Partial<APIConfigSettings['services']> | undefined;

    const services: APIConfigSettings['services'] = {
        imageGeneration: withBinding(
            incomingServices?.imageGeneration,
            DEFAULT_SETTINGS.services.imageGeneration.binding
        ),
        translate: {
            ...withBinding(
                incomingServices?.translate,
                oldBindings?.translate || DEFAULT_SETTINGS.services.translate.binding
            ),
            systemPrompt: incomingServices?.translate?.systemPrompt || DEFAULT_SETTINGS.services.translate.systemPrompt,
        },
        describe: {
            ...withBinding(
                incomingServices?.describe,
                oldBindings?.describe || DEFAULT_SETTINGS.services.describe.binding
            ),
            systemPrompt: incomingServices?.describe?.systemPrompt || DEFAULT_SETTINGS.services.describe.systemPrompt,
        },
        optimize: {
            ...withBinding(
                incomingServices?.optimize,
                oldBindings?.optimize || DEFAULT_SETTINGS.services.optimize.binding
            ),
            systemPrompt: incomingServices?.optimize?.systemPrompt || DEFAULT_SETTINGS.services.optimize.systemPrompt,
        },
        datasetLabel: {
            binding: {
                providerId: incomingServices?.datasetLabel?.binding?.providerId
                    || incomingServices?.describe?.binding?.providerId
                    || DEFAULT_SETTINGS.services.datasetLabel.binding.providerId,
                modelId: migrateModelId(incomingServices?.datasetLabel?.binding?.modelId
                    || incomingServices?.describe?.binding?.modelId
                    || DEFAULT_SETTINGS.services.datasetLabel.binding.modelId),
            }
        }
    };

    return {
        services,
        defaults: resolveDefaults(data.defaults as APIConfigSettings['defaults'] | undefined, services),
        comfyUrl: (data.comfyUrl as string) || ''
    };
}

function getMergedSettings(data: Record<string, unknown>): APIConfigSettings {
    return normalizeSettings(data);
}

export const useAPIConfigStore = create<APIConfigState>((set, get) => ({
    providers: normalizeProvidersWithBuiltins([]),
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    error: null,
    _configLoading: false,
    _configLoaded: false,

    fetchConfig: async (force = false) => {
        const state = get();
        if (state._configLoading || (state._configLoaded && !force)) return;
        set({ isLoading: true, error: null, _configLoading: true });
        try {
            const response = await fetch(`${getApiBase()}/api-config`);
            if (!response.ok) throw new Error('Failed to fetch config');
            const data = await response.json();
            const mergedSettings = getMergedSettings((data.settings || {}) as Record<string, unknown>);

            set({
                providers: normalizeProvidersWithBuiltins(data.providers || []),
                settings: mergedSettings,
                isLoading: false,
                _configLoaded: true,
                _configLoading: false
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false, _configLoading: false });
        }
    },

    addProvider: async (provider) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(provider)
            });
            if (!response.ok) throw new Error('Failed to add provider');
            const data = await response.json();
            set({ providers: normalizeProvidersWithBuiltins(data.providers || []), isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateProvider: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates })
            });
            if (!response.ok) throw new Error('Failed to update provider');
            const data = await response.json();
            set({ providers: normalizeProvidersWithBuiltins(data.providers || []), isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    removeProvider: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config?id=${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete provider');
            set(state => ({
                providers: state.providers.filter(p => p.id !== id),
                isLoading: false
            }));
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateSettings: async (settingsUpdates) => {
        const currentSettings = get().settings;
        const newSettings = getMergedSettings({ ...currentSettings, ...settingsUpdates } as unknown as Record<string, unknown>);
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSettings', settings: newSettings })
            });
            if (!response.ok) throw new Error('Failed to update settings');
            set({ settings: newSettings, isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateServiceConfig: async (service, configUpdates) => {
        const currentSettings = get().settings;
        const currentServiceConfig = currentSettings.services[service] || { binding: EMPTY_BINDING };
        const newServiceConfig = { ...currentServiceConfig, ...configUpdates };
        const currentDefaults = currentSettings.defaults || buildDefaultsFromServices(currentSettings.services);
        const nextDefaults = {
            ...currentDefaults,
            text: { ...currentDefaults.text },
            image: { ...currentDefaults.image },
        };

        if (configUpdates.binding) {
            if (service === 'optimize') {
                nextDefaults.text.textToText = { ...nextDefaults.text.textToText, binding: configUpdates.binding };
            }
            if (service === 'describe') {
                nextDefaults.text.imageToText = { ...nextDefaults.text.imageToText, binding: configUpdates.binding };
                nextDefaults.text.videoToText = { ...nextDefaults.text.videoToText, binding: configUpdates.binding };
            }
            if (service === 'imageGeneration') {
                nextDefaults.image.textToImage = { ...nextDefaults.image.textToImage, binding: configUpdates.binding };
            }
        }

        const newSettings = {
            ...currentSettings,
            services: {
                ...currentSettings.services,
                [service]: newServiceConfig
            },
            defaults: nextDefaults,
        };
        await get().updateSettings(newSettings);
    },

    importProvidersFromFile: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'importProvidersFromFile' })
            });
            if (!response.ok) throw new Error('Failed to import providers from file');
            const data = await response.json();
            set({
                providers: normalizeProvidersWithBuiltins(data.providers || []),
                isLoading: false,
                _configLoaded: true,
                _configLoading: false,
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    ensureBuiltinProviders: () => {
        set((state) => ({
            providers: normalizeProvidersWithBuiltins(state.providers),
        }));
    },

    getEnabledProviders: () => {
        return get().providers.filter(p => p.isEnabled);
    },

    getProviderById: (id) => {
        return get().providers.find(p => p.id === id);
    },

    getModelsForTask: (task) => {
        return selectModelsForContext(get().providers, 'playground', { requiredTask: task })
            .map((item) => ({
                providerId: item.providerId,
                providerName: item.providerName,
                modelId: item.modelId,
                displayName: item.displayName || item.modelId,
            }));
    },

    getModelsForContext: (context, requiredTask) => {
        return selectModelsForContext(get().providers, context, { requiredTask })
            .map((item) => ({
                providerId: item.providerId,
                providerName: item.providerName,
                modelId: item.modelId,
                displayName: item.displayName || item.modelId,
            }));
    },

    getModelEntryById: (modelId) => {
        return getModelById(get().providers, modelId);
    },

    getServiceConfig: (service) => {
        return get().settings.services[service] as ServiceConfig;
    }
}));
