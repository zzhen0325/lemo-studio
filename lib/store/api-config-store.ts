import { create } from 'zustand';
import { APIProviderConfig, APIConfigSettings, ServiceBinding, ServiceConfig, ServiceType } from '../api-config/types';
import { getApiBase } from "../api-base";

interface APIConfigState {
    // State
    providers: APIProviderConfig[];
    settings: APIConfigSettings;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchConfig: () => Promise<void>;
    addProvider: (provider: Partial<APIProviderConfig>) => Promise<void>;
    updateProvider: (id: string, updates: Partial<APIProviderConfig>) => Promise<void>;
    removeProvider: (id: string) => Promise<void>;
    updateSettings: (settings: Partial<APIConfigSettings>) => Promise<void>;
    updateServiceConfig: (service: ServiceType, config: Partial<ServiceConfig>) => Promise<void>;

    // Getters
    getEnabledProviders: () => APIProviderConfig[];
    getProviderById: (id: string) => APIProviderConfig | undefined;
    getModelsForTask: (task: 'text' | 'vision' | 'image') => { providerId: string; providerName: string; modelId: string; displayName: string }[];
    getServiceConfig: (service: ServiceType) => ServiceConfig | undefined;

    // 防重复加载标志（内部使用）
    _configLoading: boolean;
    _configLoaded: boolean;
}

const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
    binding: { providerId: '', modelId: '' },
    systemPrompt: ''
};

const DEFAULT_SETTINGS: APIConfigSettings = {
    services: {
        imageGeneration: {
            binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' }
        },
        translate: {
            binding: { providerId: 'google-translate', modelId: 'google-translate-api' }
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
        }
    },
    comfyUrl: ''
};

// 兼容旧格式的辅助函数
function migrateOldSettings(data: Record<string, unknown>): APIConfigSettings {
    // 如果已经是新格式
    if (data.services) {
        return data as unknown as APIConfigSettings;
    }

    // 从旧格式迁移
    const oldBindings = data.serviceBindings as Record<string, ServiceBinding> | undefined;
    return {
        services: {
            imageGeneration: {
                binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' }
            },
            translate: {
                binding: oldBindings?.translate || { providerId: 'google-translate', modelId: 'google-translate-api' }
            },
            describe: {
                binding: oldBindings?.describe || DEFAULT_SETTINGS.services.describe.binding,
                systemPrompt: DEFAULT_SETTINGS.services.describe.systemPrompt
            },
            optimize: {
                binding: oldBindings?.optimize || DEFAULT_SETTINGS.services.optimize.binding,
                systemPrompt: DEFAULT_SETTINGS.services.optimize.systemPrompt
            }
        },
        comfyUrl: (data.comfyUrl as string) || ''
    };
}

export const useAPIConfigStore = create<APIConfigState>((set, get) => ({
    providers: [],
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    error: null,
    // 防重复加载标志
    _configLoading: false,
    _configLoaded: false,

    fetchConfig: async () => {
        const state = get();
        // 防止重复加载
        if (state._configLoading || state._configLoaded) return;
        set({ isLoading: true, error: null, _configLoading: true });
        try {
            const response = await fetch(`${getApiBase()}/api-config`);
            if (!response.ok) throw new Error('Failed to fetch config');
            const data = await response.json();
            const migratedSettings = migrateOldSettings(data.settings || {});

            // 深度合并settings，保留默认的systemPrompt如果远程为空
            const mergedServices: APIConfigSettings['services'] = {
                imageGeneration: {
                    ...DEFAULT_SETTINGS.services.imageGeneration,
                    ...migratedSettings.services?.imageGeneration,
                },
                translate: {
                    ...DEFAULT_SETTINGS.services.translate,
                    ...migratedSettings.services?.translate,
                },
                describe: {
                    ...DEFAULT_SETTINGS.services.describe,
                    ...migratedSettings.services?.describe,
                    // 如果远程systemPrompt不为空则使用远程值，否则保留默认
                    systemPrompt: migratedSettings.services?.describe?.systemPrompt || DEFAULT_SETTINGS.services.describe.systemPrompt
                },
                optimize: {
                    ...DEFAULT_SETTINGS.services.optimize,
                    ...migratedSettings.services?.optimize,
                    // 如果远程systemPrompt不为空则使用远程值，否则保留默认
                    systemPrompt: migratedSettings.services?.optimize?.systemPrompt || DEFAULT_SETTINGS.services.optimize.systemPrompt
                }
            };

            set({
                providers: data.providers || [],
                settings: {
                    services: mergedServices,
                    comfyUrl: migratedSettings.comfyUrl || ''
                },
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
            set({ providers: data.providers, isLoading: false });
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
            set({ providers: data.providers, isLoading: false });
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
        const newSettings = { ...currentSettings, ...settingsUpdates };
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
        const currentServiceConfig = currentSettings.services[service] || DEFAULT_SERVICE_CONFIG;
        const newServiceConfig = { ...currentServiceConfig, ...configUpdates };
        const newSettings = {
            ...currentSettings,
            services: {
                ...currentSettings.services,
                [service]: newServiceConfig
            }
        };
        await get().updateSettings(newSettings);
    },

    getEnabledProviders: () => {
        return get().providers.filter(p => p.isEnabled);
    },

    getProviderById: (id) => {
        return get().providers.find(p => p.id === id);
    },

    getModelsForTask: (task) => {
        const enabledProviders = get().getEnabledProviders();
        const result: { providerId: string; providerName: string; modelId: string; displayName: string }[] = [];

        for (const provider of enabledProviders) {
            for (const model of provider.models) {
                if (model.task.includes(task)) {
                    result.push({
                        providerId: provider.id,
                        providerName: provider.name,
                        modelId: model.modelId,
                        displayName: model.displayName || model.modelId
                    });
                }
            }
        }

        return result;
    },

    getServiceConfig: (service) => {
        return get().settings.services[service];
    }
}));
