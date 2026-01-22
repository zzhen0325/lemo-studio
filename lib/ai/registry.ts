import { ModelConfig } from './types';

// Define the shape of a registry item
export interface RegistryItem {
    id: string; // e.g. 'doubao-pro-4k'
    providerType: 'openai-compatible' | 'google-genai' | 'bytedance-afr' | 'coze-image';
    task: ('text' | 'vision' | 'image')[];
    defaultConfig: ModelConfig;
}

// Hardcoded registry for now, can be dynamic later
export const REGISTRY: RegistryItem[] = [
    {
        id: 'doubao-seed-1-6-251015',
        providerType: 'openai-compatible',
        task: ['text'],
        defaultConfig: {
            providerId: 'doubao',
            modelId: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-251015',
            baseURL: "https://ark.cn-beijing.volces.com/api/v3",
            apiKey: process.env.DOUBAO_API_KEY
        }
    },
    {
        id: 'deepseek-chat',
        providerType: 'openai-compatible',
        task: ['text'],
        defaultConfig: {
            providerId: 'deepseek',
            modelId: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY
        }
    },
    {
        id: 'gemini-3-pro-image-preview',
        providerType: 'google-genai',
        task: ['text', 'vision', 'image'],
        defaultConfig: {
            providerId: 'google',
            modelId: 'gemini-3-pro-image-preview',
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        }
    },
    {
        id: 'gemini-2.5-flash-image',
        providerType: 'google-genai',
        task: ['text', 'vision', 'image'],
        defaultConfig: {
            providerId: 'google',
            modelId: 'gemini-2.5-flash-image',
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        }
    },

    {
        id: 'seed4_lemo1230',
        providerType: 'bytedance-afr',
        task: ['image'],
        defaultConfig: {
            providerId: 'bytedance',
            modelId: 'seed4_lemo1230'
        }
    },
    {
        id: 'seed4_2_lemo',
        providerType: 'bytedance-afr',
        task: ['image'],
        defaultConfig: {
            providerId: 'bytedance',
            modelId: 'seed4_2_lemo'
        }
    },
    {
        id: 'lemo_2dillustator',
        providerType: 'bytedance-afr',
        task: ['image'],
        defaultConfig: {
            providerId: 'bytedance',
            modelId: 'lemo_2dillustator'
        }
    },
    {
        id: 'lemoseedt2i',
        providerType: 'bytedance-afr',
        task: ['image'],
        defaultConfig: {
            providerId: 'bytedance',
            modelId: 'lemoseedt2i'
        }
    },
    {
        id: 'coze_seed4',
        providerType: 'coze-image',
        task: ['image'],
        defaultConfig: {
            providerId: 'coze',
            modelId: '7594371442356256806',
            apiKey: process.env.COZE_API_TOKEN,
            baseURL: 'https://bot-open-api.bytedance.net/v3/chat'
        }
    }
];
