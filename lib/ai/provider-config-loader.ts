import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { APIProviderConfig } from '@/lib/api-config/types';
import { normalizeProviderConfigs } from '@/lib/model-center';

const envPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '../../.env.local'),
  path.join(__dirname, '../../../.env.local'),
];

const PROVIDER_ENV_MAP: Record<string, string> = {
  'provider-doubao': 'DOUBAO_API_KEY',
  'provider-deepseek': 'DEEPSEEK_API_KEY',
  'provider-google': 'GOOGLE_API_KEY',
  'provider-coze': 'LEMO_COZE_API_TOKEN',
  'provider-coze-seed': 'LEMO_COZE_SEED_API_TOKEN',
  'provider-workflow-local': '',
};

let envFileLoaded = false;
let providerRuntimeConfigCache: ProviderRuntimeConfig[] | null = null;

export type ProviderRuntimeConfig = {
  id?: string;
  apiKey?: string;
  baseURL?: string;
  providerType?: string;
  isEnabled?: boolean;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  models?: Array<
    Pick<APIProviderConfig['models'][number], 'modelId'>
    & Partial<Omit<APIProviderConfig['models'][number], 'modelId'>>
  >;
};

function ensureEnvFileLoaded() {
  if (envFileLoaded) {
    return;
  }

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, quiet: true });
      break;
    }
  }

  envFileLoaded = true;
}

export function getGoogleEnvApiKey(): string {
  ensureEnvFileLoaded();
  return process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

export function resolveProviderApiKey(provider: ProviderRuntimeConfig): string {
  if (provider.id === 'provider-google') {
    return getGoogleEnvApiKey() || provider.apiKey || '';
  }

  ensureEnvFileLoaded();
  const envVarName = provider.id ? PROVIDER_ENV_MAP[provider.id] || '' : '';
  const envApiKey = envVarName ? process.env[envVarName] || '' : '';
  return provider.apiKey || envApiKey;
}

export function loadProviderRuntimeConfig(): ProviderRuntimeConfig[] {
  if (providerRuntimeConfigCache) {
    return providerRuntimeConfigCache;
  }

  try {
    ensureEnvFileLoaded();
    const configPath = path.join(__dirname, '../../data/api-config/providers.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content) as APIProviderConfig[];
    providerRuntimeConfigCache = normalizeProviderConfigs(parsed);
  } catch {
    providerRuntimeConfigCache = [];
  }

  return providerRuntimeConfigCache;
}
