/**
 * API Provider Configuration Types
 * 用于管理模型API的Provider配置
 */

export type ProviderType = 'openai-compatible' | 'google-genai' | 'bytedance-afr' | 'google-translate';

export interface ModelEntry {
    modelId: string;
    displayName: string;
    task: ('text' | 'vision' | 'image')[];
    isDefault?: boolean;
}

export interface APIProviderConfig {
    id: string;
    name: string;
    providerType: ProviderType;
    apiKey: string;
    baseURL?: string;
    models: ModelEntry[];
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ServiceBinding {
    providerId: string;
    modelId: string;
}

// 服务类型定义
export type ServiceType = 'imageGeneration' | 'translate' | 'describe' | 'optimize';

// 服务配置，包含绑定和系统提示词
export interface ServiceConfig {
    binding: ServiceBinding;
    systemPrompt?: string;
    /** 额外配置项 */
    options?: Record<string, unknown>;
}

export interface APIConfigSettings {
    services: {
        /** 图像生成 - 使用 Gemini 3 Pro / Bytedance AFR */
        imageGeneration: ServiceConfig;
        /** 翻译 - 使用 Google Translate API */
        translate: ServiceConfig;
        /** 图像描述 - 使用 Gemini 3 Pro (vision) */
        describe: ServiceConfig;
        /** 提示词优化 - 使用 Gemini / 豆包 */
        optimize: ServiceConfig;
    };
    comfyUrl: string;
    /** 向后兼容的旧字段 */
    serviceBindings?: {
        describe?: ServiceBinding;
        translate?: ServiceBinding;
        optimize?: ServiceBinding;
    };
}

// API响应类型
export interface APIConfigResponse {
    providers: APIProviderConfig[];
    settings: APIConfigSettings;
}

// 服务元信息（用于UI展示）
export const SERVICE_METADATA: Record<ServiceType, {
    label: string;
    description: string;
    requiredTask: 'text' | 'vision' | 'image' | 'translate';
    hasSystemPrompt: boolean;
}> = {
    imageGeneration: {
        label: '图像生成',
        description: '生成图像的AI模型',
        requiredTask: 'image',
        hasSystemPrompt: false
    },
    translate: {
        label: '翻译服务',
        description: '将文本翻译为其他语言',
        requiredTask: 'translate',
        hasSystemPrompt: false
    },
    describe: {
        label: '图像描述',
        description: '分析图像并生成描述',
        requiredTask: 'vision',
        hasSystemPrompt: true
    },
    optimize: {
        label: '提示词优化',
        description: '优化用户输入的提示词',
        requiredTask: 'text',
        hasSystemPrompt: true
    }
};
