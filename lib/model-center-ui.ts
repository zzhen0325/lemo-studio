import type { APIProviderConfig, ModelContext, ModelTask } from '@/lib/api-config/types';
import { selectModelsForContext } from '@/lib/model-center';
import { MODEL_ID_FLUX_KLEIN } from '@/lib/constants/models';

export interface UiModelOption {
    id: string;
    displayName: string;
}

const VIRTUAL_CONTEXT_MODELS: Array<{
    id: string;
    displayName: string;
    contexts: ModelContext[];
    requiredTask: ModelTask;
}> = [
    {
        id: MODEL_ID_FLUX_KLEIN,
        displayName: 'FluxKlein',
        contexts: ['playground', 'banner', 'infinite-canvas'],
        requiredTask: 'image',
    },
];

export function getContextModelOptions(
    providers: APIProviderConfig[],
    context: ModelContext,
    requiredTask: ModelTask,
): UiModelOption[] {
    const fromProviders = selectModelsForContext(providers, context, { requiredTask })
        .map((item) => ({
            id: item.modelId,
            displayName: item.displayName || item.modelId,
        }));

    const known = new Set(fromProviders.map((item) => item.id));
    const virtualModels = VIRTUAL_CONTEXT_MODELS
        .filter((model) => model.requiredTask === requiredTask && model.contexts.includes(context))
        .filter((model) => !known.has(model.id))
        .map((model) => ({ id: model.id, displayName: model.displayName }));

    return [...fromProviders, ...virtualModels];
}

