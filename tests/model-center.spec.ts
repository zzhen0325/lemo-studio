import { describe, expect, it } from 'vitest';
import type { APIProviderConfig } from '@/lib/api-config/types';
import {
  normalizeProviderConfigs,
  selectModelsForContext,
  validateModelUsage,
} from '@/lib/model-center';

function createProvider(partial: Partial<APIProviderConfig>): APIProviderConfig {
  return {
    id: partial.id || 'provider-test',
    name: partial.name || 'Test Provider',
    providerType: partial.providerType || 'google-genai',
    apiKey: partial.apiKey || 'test-key',
    baseURL: partial.baseURL || '',
    models: partial.models || [],
    isEnabled: partial.isEnabled ?? true,
    createdAt: partial.createdAt || '2026-02-01T00:00:00.000Z',
    updatedAt: partial.updatedAt || '2026-02-01T00:00:00.000Z',
  };
}

describe('model-center', () => {
  it('normalizes legacy model entries with conservative defaults', () => {
    const providers = normalizeProviderConfigs([
      createProvider({
        models: [
          {
            modelId: 'legacy-image-model',
            displayName: '',
            task: ['image'],
          },
        ],
      }),
    ]);

    const model = providers[0]?.models[0];
    expect(model).toBeDefined();
    expect(model.displayName).toBe('legacy-image-model');
    expect(model.status).toBe('active');
    expect(model.priority).toBe(100);
    expect(model.contexts).toEqual(
      expect.arrayContaining(['playground', 'infinite-canvas', 'service:imageGeneration'])
    );
    expect(model.contexts).not.toContain('banner');
    expect(model.capabilities?.supportsImage).toBe(true);
    expect(model.capabilities?.supportsImageSize).toBe(true);
  });

  it('keeps nano banana 2 configured image sizes', () => {
    const providers = normalizeProviderConfigs([
      createProvider({
        models: [
          {
            modelId: 'gemini-3.1-flash-image-preview',
            displayName: 'Nano banana 2',
            task: ['image'],
            contexts: ['service:imageGeneration'],
            status: 'active',
            capabilities: {
              supportsImage: true,
              supportsImageSize: true,
              allowedImageSizes: ['1K', '2K', '4K'],
            },
          },
        ],
      }),
    ]);

    const model = providers[0]?.models[0];
    expect(model?.capabilities?.allowedImageSizes).toEqual(['1K', '2K', '4K']);

    const validation = validateModelUsage({
      providers,
      modelId: 'gemini-3.1-flash-image-preview',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '4K',
    });
    expect(validation.valid).toBe(true);
  });

  it('filters models by context/task/status/provider enabled', () => {
    const providers: APIProviderConfig[] = [
      createProvider({
        id: 'provider-a',
        models: [
          {
            modelId: 'image-active',
            displayName: 'Image Active',
            task: ['image'],
            contexts: ['playground'],
            status: 'active',
          },
          {
            modelId: 'image-hidden',
            displayName: 'Image Hidden',
            task: ['image'],
            contexts: ['playground'],
            status: 'hidden',
          },
          {
            modelId: 'text-only',
            displayName: 'Text Only',
            task: ['text'],
            contexts: ['playground'],
            status: 'active',
          },
        ],
      }),
      createProvider({
        id: 'provider-disabled',
        isEnabled: false,
        models: [
          {
            modelId: 'image-disabled-provider',
            displayName: 'Image Disabled Provider',
            task: ['image'],
            contexts: ['playground'],
            status: 'active',
          },
        ],
      }),
    ];

    const models = selectModelsForContext(providers, 'playground', { requiredTask: 'image' });
    expect(models.map((item) => item.modelId)).toEqual(['image-active']);
  });

  it('exposes datasetLabel context for vision models (legacy compatibility)', () => {
    const providers = normalizeProviderConfigs([
      createProvider({
        models: [
          {
            modelId: 'vision-describe-model',
            displayName: 'Vision Describe Model',
            task: ['vision'],
            contexts: ['service:describe'],
            status: 'active',
          },
        ],
      }),
    ]);

    const models = selectModelsForContext(providers, 'service:datasetLabel', { requiredTask: 'vision' });
    expect(models.map((item) => item.modelId)).toEqual(['vision-describe-model']);
  });

  it('validates image capabilities (size, batch, refs, min dimensions)', () => {
    const providers: APIProviderConfig[] = [
      createProvider({
        models: [
          {
            modelId: 'strict-image-model',
            displayName: 'Strict Image Model',
            task: ['image'],
            contexts: ['service:imageGeneration'],
            status: 'active',
            capabilities: {
              supportsImage: true,
              supportsImageSize: true,
              allowedImageSizes: ['2K'],
              supportsBatch: true,
              maxBatchSize: 2,
              supportsMultiImage: false,
              maxReferenceImages: 1,
              minWidth: 1024,
              minHeight: 1024,
            },
          },
        ],
      }),
    ];

    const invalidSize = validateModelUsage({
      providers,
      modelId: 'strict-image-model',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '1024x1024',
    });
    expect(invalidSize.valid).toBe(false);
    expect(invalidSize.errors.some((item) => item.includes('imageSize'))).toBe(true);

    const invalidBatch = validateModelUsage({
      providers,
      modelId: 'strict-image-model',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '2K',
      batchSize: 3,
    });
    expect(invalidBatch.valid).toBe(false);
    expect(invalidBatch.errors.some((item) => item.includes('maxBatchSize'))).toBe(true);

    const invalidMultiImage = validateModelUsage({
      providers,
      modelId: 'strict-image-model',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '2K',
      referenceImageCount: 2,
    });
    expect(invalidMultiImage.valid).toBe(false);
    expect(invalidMultiImage.errors.some((item) => item.includes('multi-image'))).toBe(true);

    const invalidMinSize = validateModelUsage({
      providers,
      modelId: 'strict-image-model',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '2K',
      width: 512,
      height: 512,
    });
    expect(invalidMinSize.valid).toBe(false);
    expect(invalidMinSize.errors.some((item) => item.includes('minWidth'))).toBe(true);

    const valid = validateModelUsage({
      providers,
      modelId: 'strict-image-model',
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: '2048x2048',
      batchSize: 2,
      referenceImageCount: 0,
      width: 2048,
      height: 2048,
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);
  });
});
