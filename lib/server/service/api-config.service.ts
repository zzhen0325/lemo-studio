import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { APIProviderConfig, APIConfigSettings, APIConfigResponse } from '../../api-config/types';
import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { HttpError } from '../utils/http-error';
import { ApiProvider, ApiSettings } from '../db';
import { decryptApiKey, encryptApiKey, isApiKeyEncrypted, isApiKeyEncryptionEnabled, maskStoredApiKey } from '../utils/secret-crypto';
import { normalizeProviderConfigs } from '../../model-center';
import {
  DEFAULT_API_CONFIG_SETTINGS,
  migrateLooseModels,
  normalizeApiConfigSettings,
} from '../../api-config/core';

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
      models: migrateLooseModels(doc.models) as unknown as APIProviderConfig['models'],
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
      models: migrateLooseModels(doc.models) as unknown as APIProviderConfig['models'],
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

    await this.apiProviderModel.bulkWrite(operations as never, { ordered: false });
    console.info(`[ApiConfigService] Migrated ${operations.length} provider API keys to encrypted storage.`);
  }

  private async importProvidersFromFile(): Promise<APIProviderConfig[]> {
    const { fallbackDate, providers: parsedProviders } = await this.readProvidersFromFile();
    const existingProviders = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
    const operations = this.buildFullUpsertOperations(parsedProviders, existingProviders);

    if (operations.length > 0) {
      await this.apiProviderModel.bulkWrite(operations as never, { ordered: false });
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
            models: migrateLooseModels((provider.models || []) as unknown as Record<string, unknown>[]),
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
              models: migrateLooseModels((provider.models || []) as unknown as Record<string, unknown>[]),
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
            models: migrateLooseModels([...existingModels, ...missingModels] as unknown as Record<string, unknown>[]),
            updatedAt: now,
          },
        }
      });
    }

    if (operations.length === 0) {
      return existingProviders;
    }

    await this.apiProviderModel.bulkWrite(operations as never, { ordered: false });
    return (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
  }

  public async getAll(): Promise<APIConfigResponse> {
    try {
      const fallbackDate = new Date().toISOString();
      const dbProviders = (await this.apiProviderModel.find().lean()) as unknown as ApiProviderLeanDoc[];
      const providersRaw = await this.syncMissingProvidersFromFile(dbProviders);
      await this.migratePlaintextApiKeys(providersRaw);
      const settingsDoc = await this.apiSettingsModel.findOne({ key: 'default' }).lean();
      const settings = normalizeApiConfigSettings((settingsDoc?.settings as unknown as APIConfigSettings) || DEFAULT_API_CONFIG_SETTINGS);
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
        const resolvedSettings = normalizeApiConfigSettings(settings);
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
            models: migrateLooseModels((providerData.models || []) as unknown as Record<string, unknown>[]),
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
          models: migrateLooseModels((providerData.models || []) as unknown as Record<string, unknown>[]),
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
