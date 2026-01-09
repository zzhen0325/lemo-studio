import {
    TextProvider,
    VisionProvider,
    ImageProvider,
    TextGenerationInput,
    VisionGenerationInput,
    ImageGenerationInput,
    TextResult,
    ImageResult,
    ModelConfig
} from './types';
import { generateNonce, generateSign, generateTimestamp, getProxyAgent } from './utils';

export class OpenAICompatibleProvider implements TextProvider {
    private config: ModelConfig;

    constructor(config: ModelConfig) {
        this.config = config;
    }

    async generateText(params: TextGenerationInput): Promise<TextResult> {
        const { input, systemPrompt, options } = params;

        const messages: { role: string; content: string }[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: input });

        const body = {
            model: this.config.modelId,
            messages: messages,
            temperature: options?.temperature,
            max_tokens: options?.maxTokens,
            top_p: options?.topP,
            stream: options?.stream || false
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        const agent = getProxyAgent();
        const fetchOptions: RequestInit & { agent?: unknown } = {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        };

        if (agent) {
            fetchOptions.agent = agent;
        }

        const response = await fetch(`${this.config.baseURL}/chat/completions`, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Provider API Error: ${response.status} - ${errorText}`);
        }

        if (options?.stream) {
            // TODO: Implement standardized stream handling
            // For now fallback to text json
            throw new Error("Stream not fully implemented in adapter yet");
        }

        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content || "";

        return { text };
    }
}

export class GoogleGenAIProvider implements TextProvider, VisionProvider, ImageProvider {
    private apiKey: string;
    private modelId: string;
    private baseURL = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(config: ModelConfig) {
        console.log(`[GoogleGenAIProvider] Initializing with model: ${config.modelId}, hasApiKey: ${!!config.apiKey}`);

        this.apiKey = config.apiKey!;
        this.modelId = config.modelId;
    }

    async generateText(params: TextGenerationInput): Promise<TextResult> {
        const { input, systemPrompt } = params;

        const contents = [];
        if (systemPrompt) {
            contents.push({ role: "user", parts: [{ text: systemPrompt + "\n\n" + input }] });
        } else {
            contents.push({ role: "user", parts: [{ text: input }] });
        }

        const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google GenAI API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return { text };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Google GenAI Error: ${msg}`);
        }
    }

    async describeImage(params: VisionGenerationInput): Promise<TextResult> {
        const { image, prompt, systemPrompt } = params;

        let base64Data = image;
        let mimeType = "image/png";

        if (image.startsWith("data:")) {
            const matches = image.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        }

        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
            { inlineData: { mimeType, data: base64Data } }
        ];

        if (systemPrompt) parts.push({ text: systemPrompt });
        if (prompt) parts.push({ text: prompt });

        const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: "user", parts }] })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google GenAI API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return { text };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Google GenAI Vision Error: ${msg}`);
        }
    }

    async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
        const { prompt, aspectRatio, imageSize, image } = params;
        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

        if (image || (params.images && params.images.length > 0)) {
            const imageList = image ? [image] : (params.images || []);
            for (const img of imageList) {
                let base64Data = img;
                if (img.startsWith("data:")) {
                    base64Data = img.split(',')[1];
                }
                parts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: base64Data,
                    },
                });
            }
        }

        parts.push({ text: prompt });

        const configParams: Record<string, unknown> = {
            responseModalities: ["IMAGE"],
        };

        if (aspectRatio || imageSize) {
            configParams.imageConfig = {
                ...(aspectRatio ? { aspectRatio } : {}),
                ...(imageSize ? { imageSize } : {})
            };
        }

        const url = `${this.baseURL}/models/gemini-3-pro-image-preview:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts }],
                    generationConfig: configParams
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google GenAI API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            const resParts = candidate?.content?.parts;

            if (!resParts) throw new Error("No image data returned from Google GenAI");

            for (const part of resParts) {
                if (part.inlineData && part.inlineData.data) {
                    const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                    return { images: [dataUrl] };
                }
            }
            throw new Error("No image data found in response parts");
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Google GenAI Image Gen Error: ${msg}`);
        }
    }
}

/**
 * Bytedance Standard Image Generation API (Seed4 / ByteArtist)
 */
export class BytedanceAfrProvider implements ImageProvider {
    private config: ModelConfig;

    constructor(config: ModelConfig) {
        this.config = config;
    }

    async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
        const { prompt, width, height, batchSize, options } = params;

        const API_CONFIG = {
            BASE_URL: process.env.GATEWAY_BASE_URL || 'https://effect.bytedance.net',
            AID: process.env.BYTEDANCE_AID || '6834',
            APP_KEY: process.env.BYTEDANCE_APP_KEY || 'a89de09e9bca4723943e8830a642464d',
            APP_SECRET: process.env.BYTEDANCE_APP_SECRET || '8505d553a24c485fb7d9bb336a3651a8',
        };

        const nonce = generateNonce();
        const timestamp = generateTimestamp();
        const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

        const queryParams = new URLSearchParams({
            aid: API_CONFIG.AID,
            app_key: API_CONFIG.APP_KEY,
            timestamp,
            nonce,
            sign
        });

        const url = `${API_CONFIG.BASE_URL}/media/api/pic/afr?${queryParams.toString()}`;

        const isSeed42 = this.config.modelId === 'seed4_2_lemo';
        const conf: Record<string, any> = {
            width: width || (isSeed42 ? 2048 : 1024),
            height: height || (isSeed42 ? 2048 : 1024),
            seed: options?.seed || Math.floor(Math.random() * 2147483647),
        };

        if (isSeed42) {
            conf['Prompt'] = prompt; // Capital P as requested
            conf['local_lora_name'] = "lemo_seed4_0104_doubao@v4.safetensors";
        } else {
            conf['prompt'] = prompt;
            conf['batch_size'] = batchSize || 1;
        }

        const formData = new URLSearchParams();
        formData.append('conf', JSON.stringify(conf));
        formData.append('algorithms', this.config.modelId); // Use modelId as the algorithm name
        formData.append('img_return_format', 'png');

        if (params.image) {
            if (params.image.startsWith('http')) {
                formData.append('source', params.image);
            } else {
                const base64Data = params.image.includes(',') ? params.image.split(',')[1] : params.image;
                formData.append('base64file', base64Data);
            }
        }

        const agent = getProxyAgent();
        const fetchOptions: RequestInit & { agent?: unknown } = {
            method: 'POST',
            headers: {
                'get-svc': '1',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'ByteArtist-Client/1.0'
            },
            body: formData.toString()
        };

        if (agent) {
            fetchOptions.agent = agent;
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ByteArtist API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const success = data.success || data.message === 'success' || data.data?.algo_status_code === 0;

        if (!success) {
            throw new Error(`ByteArtist Generation Failed: ${data.message || data.algo_status_message}`);
        }

        const afr_data = (data.data?.data?.afr_data ?? data.data?.afr_data ?? []) as { pic: string }[];
        const images = afr_data.map((item) => {
            return item.pic.startsWith('http') ? item.pic : `data:image/png;base64,${item.pic}`;
        });

        return { images, metadata: data as Record<string, unknown> };
    }
}
