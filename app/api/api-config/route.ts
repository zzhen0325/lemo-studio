import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { APIProviderConfig, APIConfigSettings, APIConfigResponse } from '@/lib/api-config/types';

// 配置文件存储路径
const CONFIG_DIR = path.join(process.cwd(), 'data/api-config');
const PROVIDERS_FILE = path.join(CONFIG_DIR, 'providers.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

// 默认设置
const DEFAULT_SETTINGS: APIConfigSettings = {
    services: {
        imageGeneration: {
            binding: { providerId: 'provider-google', modelId: 'gemini-3-pro-image-preview' }
        },
        translate: {
            binding: { providerId: 'google-translate', modelId: 'google-translate-api' }
        },
        describe: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-2-0-lite-260215' },
            systemPrompt: ''
        },
        optimize: {
            binding: { providerId: 'provider-doubao', modelId: 'doubao-seed-1-6-251015' },
            systemPrompt: ''
        }
    },
    comfyUrl: ''
};

// 确保配置目录存在
async function ensureConfigDir() {
    try {
        await fs.access(CONFIG_DIR);
    } catch {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
    }
}

// 读取Providers
async function readProviders(): Promise<APIProviderConfig[]> {
    await ensureConfigDir();
    try {
        const content = await fs.readFile(PROVIDERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
}

// 保存Providers
async function saveProviders(providers: APIProviderConfig[]): Promise<void> {
    await ensureConfigDir();
    await fs.writeFile(PROVIDERS_FILE, JSON.stringify(providers, null, 2));
}

// 读取Settings
async function readSettings(): Promise<APIConfigSettings> {
    await ensureConfigDir();
    try {
        const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

// 保存Settings
async function saveSettings(settings: APIConfigSettings): Promise<void> {
    await ensureConfigDir();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET: 获取所有配置
export async function GET(): Promise<NextResponse<APIConfigResponse | { error: string }>> {
    try {
        const providers = await readProviders();
        const settings = await readSettings();

        // 脱敏处理 API Key
        const maskedProviders = providers.map(p => ({
            ...p,
            apiKey: p.apiKey ? `[MASKED:${p.apiKey.length}]` : ''
        }));

        return NextResponse.json({ providers: maskedProviders, settings });
    } catch (error) {
        console.error('Failed to read API config:', error);
        return NextResponse.json({ error: 'Failed to read API config' }, { status: 500 });
    }
}

// POST: 创建或更新Provider
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'updateSettings') {
            // 更新全局设置
            const { settings } = body as { action: string; settings: APIConfigSettings };
            await saveSettings(settings);
            return NextResponse.json({ success: true, settings });
        }

        // 创建或更新Provider
        const providerData = body as Partial<APIProviderConfig>;
        const providers = await readProviders();
        const now = new Date().toISOString();

        if (providerData.id) {
            // 更新现有Provider
            const index = providers.findIndex(p => p.id === providerData.id);
            if (index === -1) {
                return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
            }
            // 如果传入的是掩码，则保留原有的 apiKey
            const finalApiKey = (providerData.apiKey && providerData.apiKey.startsWith('[MASKED:'))
                ? providers[index].apiKey
                : providerData.apiKey;

            providers[index] = {
                ...providers[index],
                ...providerData,
                apiKey: finalApiKey ?? providers[index].apiKey,
                updatedAt: now
            };
        } else {
            // 创建新Provider
            const newProvider: APIProviderConfig = {
                id: uuidv4(),
                name: providerData.name || 'Unnamed Provider',
                providerType: providerData.providerType || 'openai-compatible',
                apiKey: providerData.apiKey || '',
                baseURL: providerData.baseURL,
                models: providerData.models || [],
                isEnabled: providerData.isEnabled ?? true,
                createdAt: now,
                updatedAt: now
            };
            providers.push(newProvider);
        }

        await saveProviders(providers);
        return NextResponse.json({ success: true, providers });
    } catch (error) {
        console.error('Failed to save API config:', error);
        return NextResponse.json({ error: 'Failed to save API config' }, { status: 500 });
    }
}

// DELETE: 删除Provider
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing provider ID' }, { status: 400 });
        }

        const providers = await readProviders();
        const filtered = providers.filter(p => p.id !== id);

        if (filtered.length === providers.length) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        await saveProviders(filtered);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete provider:', error);
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
