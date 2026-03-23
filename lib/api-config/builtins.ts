import type { APIProviderConfig } from '@/lib/api-config/types';

const BUILTIN_PROVIDER_PATCHES: APIProviderConfig[] = [
    {
        id: 'provider-coze',
        name: 'Coze (Seedream)',
        providerType: 'coze-image',
        apiKey: '',
        baseURL: 'https://bot-open-api.bytedance.net/v3/chat',
        models: [
            {
                modelId: 'coze-prompt',
                displayName: 'Coze Prompt',
                task: ['text', 'vision'],
                category: 'coze',
                contexts: ['service:optimize', 'service:describe'],
                capabilities: {
                    supportsText: true,
                    supportsVision: true,
                    supportsImage: false,
                    supportsImageEdit: false,
                    supportsAspectRatio: false,
                    supportsImageSize: false,
                    supportsSeed: false,
                    supportsBatch: false,
                    maxBatchSize: 1,
                    supportsMultiImage: false,
                    maxReferenceImages: 1,
                },
                status: 'active',
                priority: 120,
            },
        ],
        isEnabled: true,
        createdAt: '2026-01-17T00:00:00.000Z',
        updatedAt: '2026-01-17T00:00:00.000Z',
    },
    {
        id: 'provider-coze-seed',
        name: 'Coze Workflow (Seedream 4.5)',
        providerType: 'coze-image',
        apiKey: '',
        baseURL: 'https://2q3rqt6rnh.coze.site/run',
        models: [
            {
                modelId: 'coze_seedream4_5',
                displayName: 'Seedream 4.5',
                task: ['image'],
                category: 'coze',
                contexts: ['playground', 'infinite-canvas', 'service:imageGeneration'],
                capabilities: {
                    supportsAspectRatio: true,
                    supportsImageSize: true,
                    allowedImageSizes: ['1K', '2K', '4K'],
                    supportsSeed: false,
                    supportsBatch: true,
                    maxBatchSize: 4,
                    supportsMultiImage: true,
                    maxReferenceImages: 4,
                    supportsImageEdit: true,
                },
                status: 'active',
                priority: 125,
            },
        ],
        isEnabled: true,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
    },
];

export function mergeBuiltinProviders(providers: APIProviderConfig[]): APIProviderConfig[] {
    const merged = providers.map((provider) => ({
        ...provider,
        models: [...(provider.models || [])],
    }));

    for (const patch of BUILTIN_PROVIDER_PATCHES) {
        const existing = merged.find((provider) => provider.id === patch.id);
        if (!existing) {
            merged.push({
                ...patch,
                models: [...patch.models],
            });
            continue;
        }

        const knownModelIds = new Set((existing.models || []).map((model) => model.modelId));
        const missingModels = patch.models.filter((model) => !knownModelIds.has(model.modelId));
        if (missingModels.length > 0) {
            existing.models = [...(existing.models || []), ...missingModels];
        }
    }

    return merged;
}
