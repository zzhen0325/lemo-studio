import { randomUUID } from 'crypto';
import type { APIProviderConfig, APIConfigSettings, APIConfigResponse } from '../../lib/api-config/types';
import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { ApiProvider, ApiSettings } from '../db';
import { encryptApiKey, isApiKeyEncrypted, isApiKeyEncryptionEnabled, maskStoredApiKey } from '../utils/secret-crypto';

// 默认设置
const DEFAULT_SETTINGS: APIConfigSettings = {
  services: {
    imageGeneration: {
      binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
    },
    translate: {
      binding: { providerId: 'google-translate', modelId: 'google-translate-api' },
    },
    describe: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
      systemPrompt: '',
    },
    optimize: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-6-251015' },
      systemPrompt: '',
    },
  },
  comfyUrl: '',
};

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

function shouldKeepExistingMaskedApiKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('[MASKED:');
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
      models: (doc.models || []) as unknown as APIProviderConfig['models'],
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

  public async getAll(): Promise<APIConfigResponse> {
    try {
      const fallbackDate = new Date().toISOString();
      const providersRaw = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      await this.migratePlaintextApiKeys(providersRaw);
      const settingsDoc = await this.apiSettingsModel.findOne({ key: 'default' }).lean();
      const settings = (settingsDoc?.settings as unknown as APIConfigSettings) || DEFAULT_SETTINGS;
      const maskedProviders = providersRaw.map((doc) => this.toMaskedProvider(doc, fallbackDate));

      return { providers: maskedProviders, settings };
    } catch (error) {
      console.error('Failed to read API config:', error);
      throw new HttpError(500, 'Failed to read API config');
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
        await this.apiSettingsModel.updateOne(
          { key: 'default' },
          { settings: settings as unknown as Record<string, unknown>, key: 'default' },
          { upsert: true },
        );
        return { success: true, settings };
      }

      const providerData = body as Partial<APIProviderConfig>;
      const now = new Date().toISOString();

      if (providerData.id) {
        const existing = await this.apiProviderModel.findById(providerData.id);
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
          { _id: providerData.id as string },
          {
            id: providerData.id,
            name: providerData.name,
            providerType: providerData.providerType,
            apiKey: finalApiKey ?? existing.apiKey,
            baseURL: providerData.baseURL,
            models: (providerData.models || []) as unknown as Record<string, unknown>[],
            isEnabled: providerData.isEnabled,
            updatedAt: now,
          },
        );
      } else {
        const newId = providerData.id || randomUUID();
        const incomingApiKey = typeof providerData.apiKey === 'string' ? providerData.apiKey : '';

        await this.apiProviderModel.create({
          _id: newId,
          id: newId,
          name: providerData.name || 'Unnamed Provider',
          providerType: providerData.providerType || 'openai-compatible',
          apiKey: encryptApiKey(incomingApiKey),
          baseURL: providerData.baseURL,
          models: providerData.models || [],
          isEnabled: providerData.isEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        });
      }

      const fallbackDate = new Date().toISOString();
      const providersRaw = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      await this.migratePlaintextApiKeys(providersRaw);
      const providers = providersRaw.map((doc) => this.toMaskedProvider(doc, fallbackDate));
      return { success: true, providers };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to save API config:', error);
      throw new HttpError(500, 'Failed to save API config');
    }
  }

  public async deleteProvider(id: string): Promise<void> {
    try {
      const res = await this.apiProviderModel.deleteOne({ _id: id });
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
