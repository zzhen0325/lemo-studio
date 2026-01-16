import { randomUUID } from 'crypto';
import type { APIProviderConfig, APIConfigSettings, APIConfigResponse } from '../../lib/api-config/types';
import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { ApiProvider, ApiSettings } from '../db';

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
      binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' },
      systemPrompt: '',
    },
    optimize: {
      binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-6-251015' },
      systemPrompt: '',
    },
  },
  comfyUrl: '',
};

@Injectable()
export class ApiConfigService {
  @Inject(ApiProvider)
  private apiProviderModel!: ModelType<ApiProvider>;

  @Inject(ApiSettings)
  private apiSettingsModel!: ModelType<ApiSettings>;

  public async getAll(): Promise<APIConfigResponse> {
    try {
      const fallbackDate = new Date().toISOString();
      const providersRaw = await this.apiProviderModel.find().lean();
      const providers: APIProviderConfig[] = providersRaw.map((p) => ({
        id: p.id || String(p._id),
        name: p.name,
        providerType: (p.providerType as APIProviderConfig['providerType']) || 'openai-compatible',
        apiKey: p.apiKey || '',
        baseURL: p.baseURL,
        models: (p.models || []) as APIProviderConfig['models'],
        isEnabled: p.isEnabled ?? true,
        createdAt: (p.createdAt as string) || fallbackDate,
        updatedAt: (p.updatedAt as string) || fallbackDate,
      }));
      const settingsDoc = await this.apiSettingsModel.findOne({ key: 'default' }).lean();
      const settings = (settingsDoc?.settings as APIConfigSettings) || DEFAULT_SETTINGS;

      const maskedProviders = providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? `[MASKED:${p.apiKey.length}]` : '',
      }));

      return { providers: maskedProviders, settings };
    } catch (error) {
      console.error('Failed to read API config:', error);
      throw new HttpError(500, 'Failed to read API config');
    }
  }

  // body 结构与原 Next 路由保持一致：
  // - { action: 'updateSettings', settings }
  // - 或 Provider 对象，用于创建/更新 Provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async handlePost(body: any): Promise<{ success: true; settings?: APIConfigSettings; providers?: APIProviderConfig[] }> {
    try {
      const { action } = body as { action?: string };

      if (action === 'updateSettings') {
        const { settings } = body as { action: string; settings: APIConfigSettings };
        await this.apiSettingsModel.updateOne(
          { key: 'default' },
          { settings, key: 'default' },
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

        const finalApiKey =
          providerData.apiKey && providerData.apiKey.startsWith('[MASKED:')
            ? existing.apiKey
            : providerData.apiKey;

        await this.apiProviderModel.updateOne(
          { _id: providerData.id },
          {
            id: providerData.id,
            ...providerData,
            apiKey: finalApiKey ?? existing.apiKey,
            updatedAt: now,
          },
        );
      } else {
        const newId = providerData.id || randomUUID();
        await this.apiProviderModel.create({
          _id: newId,
          id: newId,
          name: providerData.name || 'Unnamed Provider',
          providerType: providerData.providerType || 'openai-compatible',
          apiKey: providerData.apiKey || '',
          baseURL: providerData.baseURL,
          models: providerData.models || [],
          isEnabled: providerData.isEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        });
      }

      const providers = (await this.apiProviderModel.find().lean()).map((p) => ({
        id: p.id || String(p._id),
        name: p.name,
        providerType: (p.providerType as APIProviderConfig['providerType']) || 'openai-compatible',
        apiKey: p.apiKey || '',
        baseURL: p.baseURL,
        models: (p.models || []) as APIProviderConfig['models'],
        isEnabled: p.isEnabled ?? true,
        createdAt: (p.createdAt as string) || new Date().toISOString(),
        updatedAt: (p.updatedAt as string) || new Date().toISOString(),
      })) as APIProviderConfig[];
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
