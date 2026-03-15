import type {
  APIConfigSettings,
  APIProviderConfig,
  DefaultModelMatrix,
  ServiceBinding,
  ServiceConfig,
} from './types';
import { serviceSupportsSystemPrompt } from './types';

export const EMPTY_SERVICE_BINDING: ServiceBinding = { providerId: '', modelId: '' };

const MODEL_ID_MIGRATIONS: Record<string, string> = {
  seed4_2_lemo: 'seed4_v2_0226lemo',
};

export const DEFAULT_TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional prompt translation engine for text-to-image workflows.',
  'Translate only. Do not explain, annotate, or add extra content.',
  'Output language must strictly match the target language requested by user.',
  'Preserve original meaning, tone, structure, and detail density.',
  'Keep comma-separated tag style if the source uses tags.',
  'Keep placeholders, symbols, model params, lora tags, and proper nouns unchanged when appropriate.',
  'Return plain translated text only, without quotes or markdown.',
].join('\n');

export const DEFAULT_API_CONFIG_SETTINGS: APIConfigSettings = {
  services: {
    imageGeneration: {
      binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
    },
    translate: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
      systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    },
    describe: {
      binding: { providerId: 'provider-coze', modelId: 'coze-prompt' },
    },
    optimize: {
      binding: { providerId: 'provider-coze', modelId: 'coze-prompt' },
    },
    datasetLabel: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
    },
  },
  defaults: {
    text: {
      textToText: { binding: { providerId: 'provider-coze', modelId: 'coze-prompt' } },
      imageToText: { binding: { providerId: 'provider-coze', modelId: 'coze-prompt' } },
      videoToText: { binding: { providerId: 'provider-coze', modelId: 'coze-prompt' } },
    },
    image: {
      textToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
      imageToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
      imagesToImage: { binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' } },
    },
  },
  comfyUrl: '',
};

export function migrateModelId(modelId?: string): string {
  if (!modelId) return '';
  return MODEL_ID_MIGRATIONS[modelId] || modelId;
}

export function migrateLooseModels(models: Record<string, unknown>[] | undefined): Record<string, unknown>[] {
  if (!Array.isArray(models)) return [];
  return models.map((model) => {
    const rawModelId = typeof model.modelId === 'string' ? model.modelId : '';
    if (!rawModelId) return model;
    const nextModelId = migrateModelId(rawModelId);
    if (nextModelId === rawModelId) return model;
    return { ...model, modelId: nextModelId };
  });
}

export function migrateProviderModelIds(providers: APIProviderConfig[]): APIProviderConfig[] {
  return providers.map((provider) => ({
    ...provider,
    models: (provider.models || []).map((model) => ({
      ...model,
      modelId: migrateModelId(model.modelId),
    })),
  }));
}

function withBinding(input?: Partial<ServiceConfig>, fallback?: ServiceBinding): ServiceConfig {
  const fallbackBinding = fallback || EMPTY_SERVICE_BINDING;
  return {
    binding: {
      providerId: input?.binding?.providerId || fallbackBinding.providerId,
      modelId: migrateModelId(input?.binding?.modelId || fallbackBinding.modelId),
    },
    systemPrompt: input?.systemPrompt,
  };
}

function resolveSystemPrompt(
  service: 'translate' | 'describe' | 'optimize',
  binding: ServiceBinding,
  inputPrompt: string | undefined,
  fallbackPrompt?: string,
): string | undefined {
  if (!serviceSupportsSystemPrompt(service, binding)) {
    return undefined;
  }

  if (typeof inputPrompt === 'string') {
    return inputPrompt;
  }

  return fallbackPrompt;
}

export function buildDefaultsFromServices(services: APIConfigSettings['services']): DefaultModelMatrix {
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
    },
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
    },
  };
}

export function normalizeApiConfigSettings(
  settings: APIConfigSettings | Record<string, unknown> | undefined,
): APIConfigSettings {
  const data = (settings || {}) as Record<string, unknown>;
  const oldBindings = data.serviceBindings as Record<string, ServiceBinding> | undefined;
  const incomingServices = data.services as Partial<APIConfigSettings['services']> | undefined;

  const services: APIConfigSettings['services'] = {
    imageGeneration: withBinding(
      incomingServices?.imageGeneration,
      DEFAULT_API_CONFIG_SETTINGS.services.imageGeneration.binding,
    ),
    translate: (() => {
      const config = withBinding(
        incomingServices?.translate,
        oldBindings?.translate || DEFAULT_API_CONFIG_SETTINGS.services.translate.binding,
      );
      const systemPrompt = resolveSystemPrompt(
        'translate',
        config.binding,
        incomingServices?.translate?.systemPrompt,
        DEFAULT_API_CONFIG_SETTINGS.services.translate.systemPrompt,
      );
      return systemPrompt === undefined ? config : { ...config, systemPrompt };
    })(),
    describe: (() => {
      const config = withBinding(
        incomingServices?.describe,
        oldBindings?.describe || DEFAULT_API_CONFIG_SETTINGS.services.describe.binding,
      );
      const systemPrompt = resolveSystemPrompt(
        'describe',
        config.binding,
        incomingServices?.describe?.systemPrompt,
      );
      return systemPrompt === undefined ? config : { ...config, systemPrompt };
    })(),
    optimize: (() => {
      const config = withBinding(
        incomingServices?.optimize,
        oldBindings?.optimize || DEFAULT_API_CONFIG_SETTINGS.services.optimize.binding,
      );
      const systemPrompt = resolveSystemPrompt(
        'optimize',
        config.binding,
        incomingServices?.optimize?.systemPrompt,
      );
      return systemPrompt === undefined ? config : { ...config, systemPrompt };
    })(),
    datasetLabel: {
      binding: {
        providerId: incomingServices?.datasetLabel?.binding?.providerId
          || incomingServices?.describe?.binding?.providerId
          || DEFAULT_API_CONFIG_SETTINGS.services.datasetLabel.binding.providerId,
        modelId: migrateModelId(
          incomingServices?.datasetLabel?.binding?.modelId
          || incomingServices?.describe?.binding?.modelId
          || DEFAULT_API_CONFIG_SETTINGS.services.datasetLabel.binding.modelId,
        ),
      },
    },
  };

  return {
    services,
    defaults: resolveDefaults(data.defaults as APIConfigSettings['defaults'] | undefined, services),
    comfyUrl: (data.comfyUrl as string) || '',
  };
}
