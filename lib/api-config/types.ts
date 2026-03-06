/**
 * API Provider Configuration Types
 * 用于管理模型API的Provider配置
 */

export type ProviderType =
    | 'openai-compatible'
    | 'google-genai'
    | 'bytedance-afr'
    | 'google-translate'
    | 'coze-image'
    | 'coze-vision'
    | 'workflow-local';

export type ModelTask = 'text' | 'vision' | 'image';

export type ModelContext =
    | 'playground'
    | 'banner'
    | 'infinite-canvas'
    | 'service:imageGeneration'
    | 'service:describe'
    | 'service:optimize'
    | 'service:datasetLabel';

export type ModelStatus = 'active' | 'deprecated' | 'hidden';

export interface ModelCapabilities {
    supportsText?: boolean;
    supportsVision?: boolean;
    supportsImage?: boolean;
    supportsImageEdit?: boolean;
    supportsAspectRatio?: boolean;
    supportsImageSize?: boolean;
    allowedImageSizes?: ('1K' | '2K' | '4K')[];
    supportsSeed?: boolean;
    supportsBatch?: boolean;
    maxBatchSize?: number;
    supportsMultiImage?: boolean;
    maxReferenceImages?: number;
    minWidth?: number;
    minHeight?: number;
}

export interface ModelEntry {
    modelId: string;
    displayName: string;
    task: ModelTask[];
    category?: string;
    contexts?: ModelContext[];
    capabilities?: ModelCapabilities;
    priority?: number;
    isDefault?: boolean;
    status?: ModelStatus;
}

export interface APIProviderConfig {
    id: string;
    name: string;
    providerType: ProviderType | string;
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
export type ServiceType = 'imageGeneration' | 'translate' | 'describe' | 'optimize' | 'datasetLabel';

// 服务配置，包含绑定和系统提示词
export interface ServiceConfig {
    binding: ServiceBinding;
    systemPrompt?: string;
    /** 额外配置项 */
    options?: Record<string, unknown>;
}

export interface DefaultModelMatrix {
    text: {
        textToText: ServiceConfig;
        imageToText: ServiceConfig;
        videoToText: ServiceConfig;
    };
    image: {
        textToImage: ServiceConfig;
        imageToImage: ServiceConfig;
        imagesToImage: ServiceConfig;
    };
}

export interface APIConfigSettings {
    defaults?: DefaultModelMatrix;
    services: {
        /** 图像生成 - 使用 Gemini 3 Pro / Bytedance AFR */
        imageGeneration: ServiceConfig;
        /** 翻译服务 */
        translate: ServiceConfig;
        /** 图像描述（describe） */
        describe: ServiceConfig;
        /** 提示词优化 */
        optimize: ServiceConfig;
        /** 训练集打标模型 */
        datasetLabel: Omit<ServiceConfig, 'systemPrompt'>;
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

export const MODEL_CONTEXT_BY_SERVICE: Partial<Record<ServiceType, ModelContext>> = {
    imageGeneration: 'service:imageGeneration',
    translate: 'service:optimize',
    describe: 'service:describe',
    optimize: 'service:optimize',
    datasetLabel: 'service:datasetLabel',
};

// 服务元信息（用于UI展示）
export const SERVICE_METADATA: Record<ServiceType, {
    label: string;
    description: string;
    requiredTask: ModelTask;
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
        requiredTask: 'text',
        hasSystemPrompt: true
    },
    describe: {
        label: '图像描述',
        description: 'Describe 图像内容',
        requiredTask: 'vision',
        hasSystemPrompt: true
    },
    optimize: {
        label: '提示词优化',
        description: '优化用户输入的提示词',
        requiredTask: 'text',
        hasSystemPrompt: true
    },
    datasetLabel: {
        label: '训练集打标',
        description: '训练集自动打标模型选择',
        requiredTask: 'vision',
        hasSystemPrompt: false
    }
};

export function serviceSupportsSystemPrompt(service: ServiceType, binding?: ServiceBinding): boolean {
    if (service === 'datasetLabel') {
        return false;
    }

    if ((service === 'describe' || service === 'optimize') && binding?.modelId === 'coze-prompt') {
        return false;
    }

    return SERVICE_METADATA[service].hasSystemPrompt;
}
