import type {
    APIProviderConfig,
    ModelCapabilities,
    ModelContext,
    ModelEntry,
    ModelStatus,
    ModelTask,
} from '@/lib/api-config/types';

const DEFAULT_IMAGE_SIZES: Array<'1K' | '2K' | '4K'> = ['1K', '2K', '4K'];
const DEFAULT_PRIORITY = 100;
const CANONICAL_IMAGE_SIZE_TO_PX: Record<'1K' | '2K' | '4K', number> = {
    '1K': 1024,
    '2K': 2048,
    '4K': 4096,
};
const REMOVED_PROVIDER_MODEL_IDS: Partial<Record<string, Set<string>>> = {
    'provider-bytedance': new Set(['seed4_lemo1230', 'lemo_2dillustator', 'lemoseedt2i']),
    'provider-coze': new Set(['coze_seed4']),
};
let warnedLegacyModelMigration = false;

const CONTEXTS_BY_TASK: Record<ModelTask, ModelContext[]> = {
    image: ['playground', 'infinite-canvas', 'service:imageGeneration'],
    vision: ['service:describe', 'service:datasetLabel'],
    text: ['service:optimize'],
};

function dedupe<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function isCanonicalImageSize(value: string): value is '1K' | '2K' | '4K' {
    return value === '1K' || value === '2K' || value === '4K';
}

function normalizeImageSizeLabel(value: string): '1K' | '2K' | '4K' | undefined {
    const normalized = value.trim().toUpperCase();
    if (isCanonicalImageSize(normalized)) return normalized;
    return undefined;
}

export function normalizeImageSizeToken(input?: string): '1K' | '2K' | '4K' | undefined {
    if (!input) return undefined;

    const label = normalizeImageSizeLabel(input);
    if (label) return label;

    const sizeMatch = input.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
    if (!sizeMatch) return undefined;

    const width = Number(sizeMatch[1]);
    const height = Number(sizeMatch[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return undefined;
    }

    const maxEdge = Math.max(width, height);
    if (maxEdge <= 1536) return '1K';
    if (maxEdge <= 3072) return '2K';
    return '4K';
}

function inferDimensionsFromImageSize(input?: string): { width: number; height: number } | undefined {
    if (!input) return undefined;
    const sizeMatch = input.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
    if (sizeMatch) {
        const width = Number(sizeMatch[1]);
        const height = Number(sizeMatch[2]);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return { width, height };
        }
    }

    const canonical = normalizeImageSizeToken(input);
    if (!canonical) return undefined;
    const side = CANONICAL_IMAGE_SIZE_TO_PX[canonical];
    return { width: side, height: side };
}

function inferCategory(modelId: string): string {
    if (modelId.startsWith('gemini-')) return 'gemini-image';
    if (modelId.startsWith('coze_')) return 'coze';
    if (modelId.includes('seed') || modelId.includes('lemo')) return 'seedream';
    if (modelId.includes('flux') || modelId === 'Workflow') return 'workflow';
    return 'general';
}

function normalizeTasks(input: ModelEntry['task']): ModelTask[] {
    const validTasks = (input || []).filter((task): task is ModelTask => ['text', 'vision', 'image'].includes(task));
    if (validTasks.length > 0) return dedupe(validTasks);
    return ['image'];
}

function deriveDefaultContexts(task: ModelTask[]): ModelContext[] {
    const contexts = task.flatMap((item) => CONTEXTS_BY_TASK[item] || []);
    return dedupe(contexts);
}

function normalizeContexts(contexts: ModelEntry['contexts'], task: ModelTask[]): ModelContext[] {
    const validContexts = (contexts || []).filter((context): context is ModelContext => [
        'playground',
        'banner',
        'infinite-canvas',
        'service:imageGeneration',
        'service:describe',
        'service:optimize',
        'service:datasetLabel',
    ].includes(context));

    if (validContexts.length > 0) {
        return dedupe(validContexts);
    }
    return deriveDefaultContexts(task);
}

function normalizeCapabilities(task: ModelTask[], capabilities?: ModelCapabilities): ModelCapabilities {
    const hasText = task.includes('text');
    const hasVision = task.includes('vision');
    const hasImage = task.includes('image');

    const supportsImageSize = capabilities?.supportsImageSize ?? hasImage;
    const supportsBatch = capabilities?.supportsBatch ?? hasImage;
    const supportsMultiImage = capabilities?.supportsMultiImage ?? hasImage;
    const supportsImageEdit = capabilities?.supportsImageEdit ?? (hasImage && supportsMultiImage);
    const normalizedAllowedImageSizes = dedupe(
        (capabilities?.allowedImageSizes || [])
            .map((item) => normalizeImageSizeToken(item))
            .filter((item): item is '1K' | '2K' | '4K' => Boolean(item))
    );

    return {
        supportsText: capabilities?.supportsText ?? hasText,
        supportsVision: capabilities?.supportsVision ?? hasVision,
        supportsImage: capabilities?.supportsImage ?? hasImage,
        supportsImageEdit,
        supportsAspectRatio: capabilities?.supportsAspectRatio ?? hasImage,
        supportsImageSize,
        allowedImageSizes: supportsImageSize
            ? (normalizedAllowedImageSizes.length > 0
                ? normalizedAllowedImageSizes
                : DEFAULT_IMAGE_SIZES)
            : undefined,
        supportsSeed: capabilities?.supportsSeed ?? hasImage,
        supportsBatch,
        maxBatchSize: supportsBatch ? (capabilities?.maxBatchSize ?? 4) : 1,
        supportsMultiImage,
        maxReferenceImages: supportsMultiImage ? (capabilities?.maxReferenceImages ?? 4) : 1,
        minWidth: capabilities?.minWidth,
        minHeight: capabilities?.minHeight,
    };
}

export function normalizeModelEntry(model: ModelEntry): ModelEntry {
    const task = normalizeTasks(model.task);
    const capabilities = normalizeCapabilities(task, model.capabilities);
    const contexts = normalizeContexts(model.contexts, task);
    // Compatibility: legacy vision models that already power describe should also be available for dataset labeling.
    if (task.includes('vision') && contexts.includes('service:describe') && !contexts.includes('service:datasetLabel')) {
        contexts.push('service:datasetLabel');
    }
    const status: ModelStatus = model.status || 'active';
    const category = model.category?.trim() || inferCategory(model.modelId);
    const displayName = model.displayName?.trim() || model.modelId;

    return {
        ...model,
        modelId: model.modelId,
        displayName,
        task,
        category,
        contexts,
        capabilities,
        priority: Number.isFinite(model.priority) ? Number(model.priority) : DEFAULT_PRIORITY,
        status,
        isDefault: Boolean(model.isDefault),
    };
}

export function normalizeProviderConfig(provider: APIProviderConfig): APIProviderConfig {
    const removedModelIds = REMOVED_PROVIDER_MODEL_IDS[provider.id];
    const filteredModels = removedModelIds
        ? (provider.models || []).filter((model) => !removedModelIds.has(model.modelId))
        : (provider.models || []);

    return {
        ...provider,
        models: filteredModels.map(normalizeModelEntry),
    };
}

export function normalizeProviderConfigs(providers: APIProviderConfig[]): APIProviderConfig[] {
    const list = providers || [];
    if (!warnedLegacyModelMigration) {
        const hasLegacyModel = list.some((provider) => (provider.models || []).some((model) => (
            !model.category
            || !model.contexts
            || !model.capabilities
            || !model.status
            || model.priority === undefined
        )));
        if (hasLegacyModel) {
            warnedLegacyModelMigration = true;
            console.warn('[model-center] Legacy models detected. Applied compatibility defaults for category/contexts/capabilities/status/priority.');
        }
    }
    return list.map(normalizeProviderConfig);
}

export interface ContextModelOption {
    providerId: string;
    providerName: string;
    providerType: string;
    isProviderEnabled: boolean;
    modelId: string;
    displayName: string;
    task: ModelTask[];
    category?: string;
    contexts: ModelContext[];
    capabilities: ModelCapabilities;
    priority: number;
    status: ModelStatus;
    isDefault?: boolean;
}

export interface SelectModelsForContextOptions {
    requiredTask?: ModelTask;
    includeDeprecated?: boolean;
    includeHidden?: boolean;
    includeDisabledProviders?: boolean;
}

export function selectModelsForContext(
    providers: APIProviderConfig[],
    context: ModelContext,
    options: SelectModelsForContextOptions = {},
): ContextModelOption[] {
    const normalized = normalizeProviderConfigs(providers);
    const result: ContextModelOption[] = [];

    for (const provider of normalized) {
        if (!options.includeDisabledProviders && !provider.isEnabled) continue;

        for (const model of provider.models || []) {
            const contexts = model.contexts || [];
            if (!contexts.includes(context)) continue;
            if (options.requiredTask && !model.task.includes(options.requiredTask)) continue;
            if (!options.includeHidden && model.status === 'hidden') continue;
            if (!options.includeDeprecated && model.status === 'deprecated') continue;

            result.push({
                providerId: provider.id,
                providerName: provider.name,
                providerType: provider.providerType,
                isProviderEnabled: Boolean(provider.isEnabled),
                modelId: model.modelId,
                displayName: model.displayName,
                task: model.task,
                category: model.category,
                contexts,
                capabilities: model.capabilities || {},
                priority: Number(model.priority ?? DEFAULT_PRIORITY),
                status: model.status || 'active',
                isDefault: model.isDefault,
            });
        }
    }

    return result.sort((a, b) => {
        if (Boolean(a.isDefault) !== Boolean(b.isDefault)) {
            return a.isDefault ? -1 : 1;
        }
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.displayName.localeCompare(b.displayName, 'zh-CN');
    });
}

export function getModelById(
    providers: APIProviderConfig[],
    modelId: string,
): ContextModelOption | undefined {
    const normalized = normalizeProviderConfigs(providers);
    for (const provider of normalized) {
        const model = (provider.models || []).find((item) => item.modelId === modelId);
        if (!model) continue;
        return {
            providerId: provider.id,
            providerName: provider.name,
            providerType: provider.providerType,
            isProviderEnabled: Boolean(provider.isEnabled),
            modelId: model.modelId,
            displayName: model.displayName,
            task: model.task,
            category: model.category,
            contexts: model.contexts || [],
            capabilities: model.capabilities || {},
            priority: Number(model.priority ?? DEFAULT_PRIORITY),
            status: model.status || 'active',
            isDefault: model.isDefault,
        };
    }
    return undefined;
}

export interface ModelValidationInput {
    providers: APIProviderConfig[];
    modelId: string;
    requiredTask: ModelTask;
    context?: ModelContext;
    imageSize?: string;
    aspectRatio?: string;
    batchSize?: number;
    referenceImageCount?: number;
    width?: number;
    height?: number;
}

export interface ModelValidationResult {
    valid: boolean;
    errors: string[];
    model?: ContextModelOption;
}

export function validateModelUsage(input: ModelValidationInput): ModelValidationResult {
    const model = getModelById(input.providers, input.modelId);
    if (!model) {
        return { valid: false, errors: [`Model ${input.modelId} not found`] };
    }

    const errors: string[] = [];
    const caps = model.capabilities || {};
    const referenceImageCount = Number(input.referenceImageCount || 0);

    if (!model.isProviderEnabled) {
        errors.push(`Provider ${model.providerName} is disabled`);
    }
    if (model.status === 'hidden') {
        errors.push(`Model ${model.modelId} is hidden`);
    }
    if (!model.task.includes(input.requiredTask)) {
        errors.push(`Model ${model.modelId} does not support ${input.requiredTask}`);
    }
    if (input.context && !(model.contexts || []).includes(input.context)) {
        errors.push(`Model ${model.modelId} is not allowed in context ${input.context}`);
    }

    if (input.requiredTask === 'text' && caps.supportsText === false) {
        errors.push(`Model ${model.modelId} does not support text generation`);
    }
    if (input.requiredTask === 'vision' && caps.supportsVision === false) {
        errors.push(`Model ${model.modelId} does not support vision`);
    }
    if (input.requiredTask === 'image') {
        if (caps.supportsImage === false) {
            errors.push(`Model ${model.modelId} does not support image generation`);
        }

        if (input.aspectRatio && caps.supportsAspectRatio === false) {
            errors.push(`Model ${model.modelId} does not support aspectRatio`);
        }

        if (input.imageSize) {
            if (caps.supportsImageSize === false) {
                errors.push(`Model ${model.modelId} does not support imageSize`);
            } else if (caps.allowedImageSizes?.length) {
                const normalizedImageSize = normalizeImageSizeToken(input.imageSize);
                if (!normalizedImageSize) {
                    errors.push(`imageSize ${input.imageSize} is invalid; expected 1K/2K/4K or WIDTHxHEIGHT`);
                } else if (!caps.allowedImageSizes.includes(normalizedImageSize)) {
                    errors.push(`imageSize ${input.imageSize} is not allowed for model ${model.modelId}`);
                }
            }
        }

        if (typeof input.batchSize === 'number') {
            if (input.batchSize > 1 && caps.supportsBatch === false) {
                errors.push(`Model ${model.modelId} does not support batch generation`);
            }
            if (typeof caps.maxBatchSize === 'number' && input.batchSize > caps.maxBatchSize) {
                errors.push(`batchSize ${input.batchSize} exceeds maxBatchSize ${caps.maxBatchSize}`);
            }
        }

        if (referenceImageCount > 0 && caps.supportsImageEdit === false) {
            errors.push(`Model ${model.modelId} does not support image editing with reference images`);
        }
        if (referenceImageCount > 1 && caps.supportsMultiImage === false) {
            errors.push(`Model ${model.modelId} does not support multi-image input`);
        }
        if (typeof caps.maxReferenceImages === 'number' && referenceImageCount > caps.maxReferenceImages) {
            errors.push(`reference image count ${referenceImageCount} exceeds limit ${caps.maxReferenceImages}`);
        }

        const inferredSize = inferDimensionsFromImageSize(input.imageSize);
        const width = typeof input.width === 'number' ? input.width : inferredSize?.width;
        const height = typeof input.height === 'number' ? input.height : inferredSize?.height;

        if (typeof width === 'number' && typeof caps.minWidth === 'number' && width < caps.minWidth) {
            errors.push(`width ${width}px is below minWidth ${caps.minWidth}px`);
        }
        if (typeof height === 'number' && typeof caps.minHeight === 'number' && height < caps.minHeight) {
            errors.push(`height ${height}px is below minHeight ${caps.minHeight}px`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        model,
    };
}

export function getModelDisplayName(providers: APIProviderConfig[], modelId?: string): string | undefined {
    if (!modelId) return undefined;
    return getModelById(providers, modelId)?.displayName;
}
