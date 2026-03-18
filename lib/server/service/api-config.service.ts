import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { APIProviderConfig, APIConfigSettings, APIConfigResponse } from '../../api-config/types';
import { normalizeProviderConfigs } from '../../model-center';
import {
  DEFAULT_API_CONFIG_SETTINGS,
  migrateLooseModels,
  normalizeApiConfigSettings,
} from '../../api-config/core';

// Provider 类型到环境变量名的映射
const PROVIDER_ENV_MAP: Record<string, string> = {
  'provider-doubao': 'DOUBAO_API_KEY',
  'provider-deepseek': 'DEEPSEEK_API_KEY',
  'provider-google': 'GOOGLE_API_KEY',
  'provider-coze': 'LEMO_COZE_API_TOKEN',
  'provider-coze-seed': 'LEMO_COZE_SEED_API_TOKEN',
  'provider-coze-prompt': 'LEMO_COZE_PROMPT_API_TOKEN',
};

function getGoogleEnvApiKey(): string {
  return process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function resolveApiKey(provider: APIProviderConfig): string {
  // 优先使用环境变量
  if (provider.id === 'provider-google') {
    return getGoogleEnvApiKey() || provider.apiKey || '';
  }

  const envVarName = provider.id ? PROVIDER_ENV_MAP[provider.id] : '';
  const envApiKey = envVarName ? process.env[envVarName] || '' : '';
  
  // 如果环境变量有值，使用环境变量；否则使用文件中的配置
  return envApiKey || provider.apiKey || '';
}

function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '***';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

/**
 * 简化版 API 配置服务
 * 直接从 providers.json 文件和环境变量读取配置，不依赖数据库
 */
export class ApiConfigService {
  private cachedProviders: APIProviderConfig[] | null = null;

  private async readProvidersFromFile(): Promise<APIProviderConfig[]> {
    if (this.cachedProviders) {
      return this.cachedProviders;
    }

    const candidatePaths = [
      path.join(process.cwd(), 'data/api-config/providers.json'),
      path.join(process.cwd(), '../data/api-config/providers.json'),
      path.join(process.cwd(), '../../data/api-config/providers.json'),
      path.join(__dirname, '../../data/api-config/providers.json'),
      path.join(__dirname, '../../../data/api-config/providers.json'),
    ];
    const filePath = candidatePaths.find((candidate) => existsSync(candidate));

    if (!filePath) {
      console.warn('[ApiConfigService] providers.json not found, returning empty array');
      return [];
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('providers.json must be an array');
      }
      this.cachedProviders = normalizeProviderConfigs(parsed as APIProviderConfig[]);
      return this.cachedProviders;
    } catch (error) {
      console.error('[ApiConfigService] Failed to read providers.json:', error);
      return [];
    }
  }

  /**
   * 获取所有 provider 配置（用于前端展示，API Key 已脱敏）
   */
  public async getAll(): Promise<APIConfigResponse> {
    const providers = await this.readProvidersFromFile();
    
    // 脱敏处理
    const maskedProviders = providers.map((provider) => ({
      ...provider,
      apiKey: maskApiKey(resolveApiKey(provider)),
    }));

    return {
      providers: normalizeProviderConfigs(maskedProviders),
      settings: DEFAULT_API_CONFIG_SETTINGS,
    };
  }

  /**
   * 获取运行时 provider 配置（用于后端调用，包含真实 API Key）
   */
  public async getRuntimeProviders(): Promise<APIProviderConfig[]> {
    const providers = await this.readProvidersFromFile();
    
    // 从环境变量解析真实的 API Key
    const runtimeProviders = providers.map((provider) => ({
      ...provider,
      apiKey: resolveApiKey(provider),
    }));

    return normalizeProviderConfigs(runtimeProviders);
  }

  /**
   * 处理 POST 请求（已简化，仅返回当前配置）
   */
  public async handlePost(body: unknown): Promise<{ success: true; settings?: APIConfigSettings; providers?: APIProviderConfig[] }> {
    const { action } = body as { action?: string };

    // 只支持 importProvidersFromFile 和获取配置
    if (action === 'importProvidersFromFile') {
      // 清除缓存，重新读取
      this.cachedProviders = null;
      const providers = await this.readProvidersFromFile();
      const maskedProviders = providers.map((provider) => ({
        ...provider,
        apiKey: maskApiKey(resolveApiKey(provider)),
      }));
      return { success: true, providers: normalizeProviderConfigs(maskedProviders) };
    }

    if (action === 'updateSettings') {
      // 设置已不再持久化，直接返回默认设置
      const { settings } = body as { action: string; settings: APIConfigSettings };
      return { success: true, settings: normalizeApiConfigSettings(settings) };
    }

    // 默认返回当前配置
    const { providers } = await this.getAll();
    return { success: true, providers };
  }

  /**
   * 删除 provider（已简化，不再支持）
   */
  public async deleteProvider(_id: string): Promise<void> {
    console.warn('[ApiConfigService] deleteProvider is no longer supported. Providers are managed via providers.json');
  }
}
