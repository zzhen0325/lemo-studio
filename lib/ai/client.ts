import { ProviderOptions } from './types';
import { getApiBase } from "@/lib/api-base";

export interface ClientGenerationParams {
    model: string; // e.g. doubao-pro-4k
    input: string;
    profileId?: string;
    systemPrompt?: string;
    provider?: string; // Optional, usually inferred from model
    options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        stream?: boolean;
    };
}

export interface ClientDescribeParams {
    model: string;
    image: string; // Base64 or URL
    input?: string; // Optional prompt along with image
    profileId?: string;
    systemPrompt?: string;
    options?: ProviderOptions;
}

export interface ClientImageParams {
    model: string;
    prompt: string;
    width?: number;
    height?: number;
    batchSize?: number;
    aspectRatio?: string;
    image?: string; // for i2i
    images?: string[]; // Multiple images support
    options?: ProviderOptions & {
        seed?: number;
        steps?: number;
        cfgScale?: number;
        sampler?: string;
        scheduler?: string;
    };
}

export async function generateText(params: ClientGenerationParams): Promise<{ text: string }> {
    const response = await fetch(`${getApiBase()}/ai/text`, {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
    }

    return await response.json();
}

export async function describeImage(params: ClientDescribeParams): Promise<{ text: string }> {
    const response = await fetch(`${getApiBase()}/ai/describe`, {

        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
    }

    return await response.json();
}

export async function generateImage(
    params: ClientImageParams,
    onStream?: (chunk: { text?: string; images?: string[] }) => void
): Promise<{ images: string[]; metadata?: Record<string, unknown> }> {
    const response = await fetch(`${getApiBase()}/ai/image`, {

        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('text/event-stream') && onStream) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        const decoder = new TextDecoder();
        let finalImages: string[] = [];
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const dataStr = trimmed.substring(5).trim();
                try {
                    const data = JSON.parse(dataStr);
                    if (data.text) {
                        onStream({ text: data.text });
                    }
                    if (data.images) {
                        finalImages = data.images;
                        onStream({ images: data.images });
                    }
                } catch { /* ignore parsing errors */ }
            }
        }

        return { images: finalImages, metadata: { isStream: true } };
    }

    return await response.json();
}
