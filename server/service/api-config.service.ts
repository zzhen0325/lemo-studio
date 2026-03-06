import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { APIProviderConfig, APIConfigSettings, APIConfigResponse, ServiceBinding, ServiceConfig } from '../../lib/api-config/types';
import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { ApiProvider, ApiSettings } from '../db';
import { decryptApiKey, encryptApiKey, isApiKeyEncrypted, isApiKeyEncryptionEnabled, maskStoredApiKey } from '../utils/secret-crypto';
import { normalizeProviderConfigs } from '../../lib/model-center';

const EMPTY_BINDING: ServiceBinding = { providerId: '', modelId: '' };

const MODEL_ID_MIGRATIONS: Record<string, string> = {
  seed4_2_lemo: 'seed4_v2_0226lemo',
};

function migrateModelId(modelId?: string): string {
  if (!modelId) return '';
  return MODEL_ID_MIGRATIONS[modelId] || modelId;
}

function migrateModels(models: Record<string, unknown>[] | undefined): Record<string, unknown>[] {
  if (!Array.isArray(models)) return [];
  return models.map((model) => {
    const rawModelId = typeof model.modelId === 'string' ? model.modelId : '';
    if (!rawModelId) return model;
    const nextModelId = migrateModelId(rawModelId);
    if (nextModelId === rawModelId) return model;
    return { ...model, modelId: nextModelId };
  });
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
      binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
    },
    translate: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
      systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    },
    describe: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
      systemPrompt: '',
    },
    optimize: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-8-251228' },
      systemPrompt: '',
    },
    datasetLabel: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
    },
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
  comfyUrl: '',
};

function withBinding(input?: Partial<ServiceConfig>, fallback?: ServiceBinding): ServiceConfig {
  const fallbackBinding = fallback || EMPTY_BINDING;
  return {
    binding: {
      providerId: input?.binding?.providerId || fallbackBinding.providerId,
      modelId: migrateModelId(input?.binding?.modelId || fallbackBinding.modelId),
    },
    systemPrompt: input?.systemPrompt,
  };
}

function resolveSettings(settings: APIConfigSettings | Record<string, unknown> | undefined): APIConfigSettings {
  const data = (settings || {}) as Record<string, unknown>;
  const oldBindings = data.serviceBindings as Record<string, ServiceBinding> | undefined;
  const incomingServices = data.services as Partial<APIConfigSettings['services']> | undefined;

  const services: APIConfigSettings['services'] = {
    imageGeneration: withBinding(incomingServices?.imageGeneration, DEFAULT_SETTINGS.services.imageGeneration.binding),
    translate: {
      ...withBinding(
        incomingServices?.translate,
        oldBindings?.translate || DEFAULT_SETTINGS.services.translate.binding,
      ),
      systemPrompt: incomingServices?.translate?.systemPrompt || DEFAULT_SETTINGS.services.translate.systemPrompt,
    },
    describe: {
      ...withBinding(
        incomingServices?.describe,
        oldBindings?.describe || DEFAULT_SETTINGS.services.describe.binding,
      ),
      systemPrompt: incomingServices?.describe?.systemPrompt || DEFAULT_SETTINGS.services.describe.systemPrompt,
    },
    optimize: {
      ...withBinding(
        incomingServices?.optimize,
        oldBindings?.optimize || DEFAULT_SETTINGS.services.optimize.binding,
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

  const defaults = data.defaults as APIConfigSettings['defaults'] | undefined;
  const fallbackDefaults = {
    text: {
      textToText: { binding: services.optimize.binding },
      imageToText: { binding: services.describe.binding },
      videoToText: { binding: services.describe.binding },
    },
    image: {
      textToImage: { binding: services.imageGeneration.binding },
      imageToImage: { binding: services.imageGeneration.binding },
      imagesToImage: { binding: services.imageGeneration.binding },
    },
  };

  return {
    services,
    defaults: {
      text: {
        textToText: withBinding(defaults?.text?.textToText, fallbackDefaults.text.textToText.binding),
        imageToText: withBinding(defaults?.text?.imageToText, fallbackDefaults.text.imageToText.binding),
        videoToText: withBinding(defaults?.text?.videoToText, fallbackDefaults.text.videoToText.binding),
      },
      image: {
        textToImage: withBinding(defaults?.image?.textToImage, fallbackDefaults.image.textToImage.binding),
        imageToImage: withBinding(defaults?.image?.imageToImage, fallbackDefaults.image.imageToImage.binding),
        imagesToImage: withBinding(defaults?.image?.imagesToImage, fallbackDefaults.image.imagesToImage.binding),
      },
    },
    comfyUrl: (data.comfyUrl as string) || '',
  };
}

interface ApiProviderLeanDoc {
  _id?: unknown;
  id?: string;
  name: string;
  providerType?: string;
  apiKey?: string;
  baseURL?: string;
  models?: Record<string, unknown>[];
  isEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface FileProvidersReadResult {
  fallbackDate: string;
  providers: APIProviderConfig[];
}

function shouldKeepExistingMaskedApiKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('[MASKED:');
}

function isObjectIdString(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

@Injectable()
export class ApiConfigService {
  @Inject(ApiProvider)
  private apiProviderModel!: ModelType<ApiProvider>;

  @Inject(ApiSettings)
  private apiSettingsModel!: ModelType<ApiSettings>;

  private toMaskedProvider(doc: ApiProviderLeanDoc, fallbackDate: string): APIProviderConfig {
    return {
      id: doc.id || String(doc._id),
      name: doc.name,
      providerType: (doc.providerType as APIProviderConfig['providerType']) || 'openai-compatible',
      apiKey: maskStoredApiKey(doc.apiKey),
      baseURL: doc.baseURL,
      models: migrateModels(doc.models) as unknown as APIProviderConfig['models'],
      isEnabled: doc.isEnabled ?? true,
      createdAt: (doc.createdAt as string) || fallbackDate,
      updatedAt: (doc.updatedAt as string) || fallbackDate,
    };
  }

  private toRuntimeProvider(doc: ApiProviderLeanDoc, fallbackDate: string): APIProviderConfig {
    const storedApiKey = typeof doc.apiKey === 'string' ? doc.apiKey : '';
    const decryptedApiKey = decryptApiKey(storedApiKey);

    return {
      id: doc.id || String(doc._id),
      name: doc.name,
      providerType: (doc.providerType as APIProviderConfig['providerType']) || 'openai-compatible',
      apiKey: decryptedApiKey ?? '',
      baseURL: doc.baseURL,
      models: migrateModels(doc.models) as unknown as APIProviderConfig['models'],
      isEnabled: doc.isEnabled ?? true,
      createdAt: (doc.createdAt as string) || fallbackDate,
      updatedAt: (doc.updatedAt as string) || fallbackDate,
    };
  }

  private async migratePlaintextApiKeys(docs: ApiProviderLeanDoc[]): Promise<void> {
    if (!isApiKeyEncryptionEnabled()) return;

    const now = new Date().toISOString();
    const operations: Array<{
      updateOne: {
        filter: { _id?: unknown };
        update: { apiKey: string; updatedAt: string };
      };
    }> = [];

    for (const doc of docs) {
      const storedApiKey = doc.apiKey || '';
      if (!storedApiKey || isApiKeyEncrypted(storedApiKey)) continue;
      if (!doc._id) continue;

      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { apiKey: encryptApiKey(storedApiKey), updatedAt: now },
        },
      });
    }

    if (operations.length === 0) return;

    await this.apiProviderModel.bulkWrite(operations, { ordered: false });
    console.info(`[ApiConfigService] Migrated ${operations.length} provider API keys to encrypted storage.`);
  }

  private async importProvidersFromFile(): Promise<APIProviderConfig[]> {
    const { fallbackDate, providers: parsedProviders } = await this.readProvidersFromFile();
    const existingProviders = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
    const operations = this.buildFullUpsertOperations(parsedProviders, existingProviders);

    if (operations.length > 0) {
      await this.apiProviderModel.bulkWrite(operations, { ordered: false });
    }

    const providersRaw = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
    await this.migratePlaintextApiKeys(providersRaw);
    return providersRaw.map((doc) => this.toMaskedProvider(doc, fallbackDate));
  }

  private async readProvidersFromFile(): Promise<FileProvidersReadResult> {
    const fallbackDate = new Date().toISOString();
    const candidatePaths = [
      path.join(process.cwd(), 'data/api-config/providers.json'),
      path.join(process.cwd(), '../data/api-config/providers.json'),
      path.join(process.cwd(), '../../data/api-config/providers.json'),
      path.join(__dirname, '../../data/api-config/providers.json'),
      path.join(__dirname, '../../../data/api-config/providers.json'),
    ];
    const filePath = candidatePaths.find((candidate) => existsSync(candidate));

    let parsedProviders: APIProviderConfig[];
    try {
      if (!filePath) {
        throw new Error('providers.json not found');
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('providers.json must be an array');
      }
      parsedProviders = normalizeProviderConfigs(parsed as APIProviderConfig[]);
    } catch (error) {
      console.error(`[ApiConfigService] Failed to import providers from ${filePath}:`, error);
      throw new HttpError(400, 'Failed to read providers.json');
    }

    return { fallbackDate, providers: parsedProviders };
  }

  private buildFullUpsertOperations(parsedProviders: APIProviderConfig[], existingProviders: ApiProviderLeanDoc[]) {
    const existingById = new Map<string, ApiProviderLeanDoc>();
    for (const provider of existingProviders) {
      const id = provider.id || (provider._id ? String(provider._id) : '');
      if (id) existingById.set(id, provider);
    }

    const now = new Date().toISOString();
    return parsedProviders.map((provider) => {
      const id = provider.id || randomUUID();
      const existing = existingById.get(id);
      const incomingApiKey = typeof provider.apiKey === 'string' ? provider.apiKey : '';
      const existingStoredApiKey = typeof existing?.apiKey === 'string' ? existing.apiKey : '';
      const finalApiKey = incomingApiKey
        ? encryptApiKey(incomingApiKey)
        : (existingStoredApiKey || '');

      return {
        updateOne: {
          filter: { id },
          update: {
            id,
            name: provider.name || 'Unnamed Provider',
            providerType: provider.providerType || 'openai-compatible',
            apiKey: finalApiKey,
            baseURL: provider.baseURL,
            models: migrateModels((provider.models || []) as unknown as Record<string, unknown>[]),
            isEnabled: provider.isEnabled ?? true,
            createdAt: provider.createdAt || existing?.createdAt || now,
            updatedAt: now,
          },
          upsert: true,
        }
      };
    });
  }

  private async syncMissingProvidersFromFile(existingProviders: ApiProviderLeanDoc[]): Promise<ApiProviderLeanDoc[]> {
    let fileProviders: APIProviderConfig[];
    try {
      const loaded = await this.readProvidersFromFile();
      fileProviders = loaded.providers;
    } catch {
      return existingProviders;
    }

    const now = new Date().toISOString();
    const existingById = new Map<string, ApiProviderLeanDoc>();
    for (const provider of existingProviders) {
      const id = provider.id || (provider._id ? String(provider._id) : '');
      if (id) existingById.set(id, provider);
    }

    const operations: Array<{
      updateOne: {
        filter: { id: string };
        update: Record<string, unknown>;
        upsert?: boolean;
      };
    }> = [];

    for (const provider of fileProviders) {
      const id = provider.id || randomUUID();
      const existing = existingById.get(id);

      if (!existing) {
        const incomingApiKey = typeof provider.apiKey === 'string' ? provider.apiKey : '';
        operations.push({
          updateOne: {
            filter: { id },
            update: {
              id,
              name: provider.name || 'Unnamed Provider',
              providerType: provider.providerType || 'openai-compatible',
              apiKey: incomingApiKey ? encryptApiKey(incomingApiKey) : '',
              baseURL: provider.baseURL,
              models: migrateModels((provider.models || []) as unknown as Record<string, unknown>[]),
              isEnabled: provider.isEnabled ?? true,
              createdAt: provider.createdAt || now,
              updatedAt: now,
            },
            upsert: true,
          }
        });
        continue;
      }

      const existingModels = Array.isArray(existing.models) ? existing.models : [];
      const existingModelIds = new Set(
        existingModels
          .map((model) => (typeof model?.modelId === 'string' ? model.modelId : ''))
          .filter(Boolean)
      );
      const missingModels = (provider.models || []).filter((model) => !existingModelIds.has(model.modelId));
      if (missingModels.length === 0) continue;

      operations.push({
        updateOne: {
          filter: { id },
          update: {
            models: migrateModels([...existingModels, ...missingModels] as unknown as Record<string, unknown>[]),
            updatedAt: now,
          },
        }
      });
    }

    if (operations.length === 0) {
      return existingProviders;
    }

    await this.apiProviderModel.bulkWrite(operations, { ordered: false });
    return (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
  }

  public async getAll(): Promise<APIConfigResponse> {
    try {
      const fallbackDate = new Date().toISOString();
      const dbProviders = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      const providersRaw = await this.syncMissingProvidersFromFile(dbProviders);
      await this.migratePlaintextApiKeys(providersRaw);
      const settingsDoc = await this.apiSettingsModel.findOne({ key: 'default' }).lean();
      const settings = resolveSettings((settingsDoc?.settings as unknown as APIConfigSettings) || DEFAULT_SETTINGS);
      const maskedProviders = providersRaw.map((doc) => this.toMaskedProvider(doc, fallbackDate));

      return { providers: normalizeProviderConfigs(maskedProviders), settings };
    } catch (error) {
      console.error('Failed to read API config:', error);
      throw new HttpError(500, 'Failed to read API config');
    }
  }

  public async getRuntimeProviders(): Promise<APIProviderConfig[]> {
    try {
      const fallbackDate = new Date().toISOString();
      const dbProviders = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      const providersRaw = await this.syncMissingProvidersFromFile(dbProviders);
      await this.migratePlaintextApiKeys(providersRaw);
      const runtimeProviders = providersRaw.map((doc) => this.toRuntimeProvider(doc, fallbackDate));
      return normalizeProviderConfigs(runtimeProviders);
    } catch (error) {
      console.error('Failed to read runtime providers:', error);
      throw new HttpError(500, 'Failed to read runtime providers');
    }
  }

  // body 结构与原 Next 路由保持一致：
  // - { action: 'updateSettings', settings }
  // - 或 Provider 对象，用于创建/更新 Provider
  public async handlePost(body: unknown): Promise<{ success: true; settings?: APIConfigSettings; providers?: APIProviderConfig[] }> {
    try {
      const { action } = body as { action?: string };

      if (action === 'updateSettings') {
        const { settings } = body as { action: string; settings: APIConfigSettings };
        const resolvedSettings = resolveSettings(settings);
        await this.apiSettingsModel.updateOne(
          { key: 'default' },
          { settings: resolvedSettings as unknown as Record<string, unknown>, key: 'default' },
          { upsert: true },
        );
        return { success: true, settings: resolvedSettings };
      }

      if (action === 'importProvidersFromFile') {
        const providers = await this.importProvidersFromFile();
        return { success: true, providers };
      }

      const providerData = body as Partial<APIProviderConfig>;
      const now = new Date().toISOString();

      if (providerData.id) {
        const existingByBusinessId = await this.apiProviderModel.findOne({ id: providerData.id });
        const existingByObjectId = !existingByBusinessId && isObjectIdString(providerData.id)
          ? await this.apiProviderModel.findById(providerData.id)
          : null;
        const existing = existingByBusinessId || existingByObjectId;
        if (!existing) {
          throw new HttpError(404, 'Provider not found');
        }

        const existingStoredApiKey = typeof existing.apiKey === 'string' ? existing.apiKey : '';
        const incomingApiKey = typeof providerData.apiKey === 'string' ? providerData.apiKey : undefined;

        const finalApiKey =
          shouldKeepExistingMaskedApiKey(incomingApiKey)
            ? existingStoredApiKey
            : incomingApiKey === undefined
              ? existingStoredApiKey
              : encryptApiKey(incomingApiKey);

        await this.apiProviderModel.updateOne(
          existingByBusinessId ? { id: providerData.id } : { _id: providerData.id as string },
          {
            id: providerData.id || existing.id || randomUUID(),
            name: providerData.name,
            providerType: providerData.providerType,
            apiKey: finalApiKey ?? existing.apiKey,
            baseURL: providerData.baseURL,
            models: migrateModels((providerData.models || []) as unknown as Record<string, unknown>[]),
            isEnabled: providerData.isEnabled,
            updatedAt: now,
          },
        );
      } else {
        const newId = providerData.id || randomUUID();
        const incomingApiKey = typeof providerData.apiKey === 'string' ? providerData.apiKey : '';

        await this.apiProviderModel.create({
          id: newId,
          name: providerData.name || 'Unnamed Provider',
          providerType: providerData.providerType || 'openai-compatible',
          apiKey: encryptApiKey(incomingApiKey),
          baseURL: providerData.baseURL,
          models: migrateModels((providerData.models || []) as unknown as Record<string, unknown>[]),
          isEnabled: providerData.isEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        });
      }

      const fallbackDate = new Date().toISOString();
      const providersRaw = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      await this.migratePlaintextApiKeys(providersRaw);
      const providers = providersRaw.map((doc) => this.toMaskedProvider(doc, fallbackDate));
      return { success: true, providers: normalizeProviderConfigs(providers) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to save API config:', error);
      throw new HttpError(500, `Failed to save API config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async deleteProvider(id: string): Promise<void> {
    try {
      const filter = isObjectIdString(id)
        ? { $or: [{ id }, { _id: id }] }
        : { id };
      const res = await this.apiProviderModel.deleteOne(filter);
      if (res.deletedCount === 0) {
        throw new HttpError(404, 'Provider not found');
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to delete provider:', error);
      throw new HttpError(500, 'Failed to delete provider');
    }
  }
}
