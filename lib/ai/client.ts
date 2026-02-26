import { ProviderOptions } from './types';
import { getApiBase } from "../api-base";

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
    prompt?: string; // Optional prompt along with image
    input?: string; // Deprecated alias of prompt
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
    imageSize?: string;
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
    const { input, prompt, ...rest } = params;
    const payload = {
        ...rest,
        prompt: prompt ?? input,
    };

    const response = await fetch(`${getApiBase()}/ai/describe`, {

        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
    onStream?: (chunk: { text?: string; images?: string[] }) => void | Promise<void>
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
    console.log(`[ai-client] response status: ${response.status}, contentType: ${contentType}`);

    if (contentType?.includes('text/event-stream') && onStream) {
        console.log(`[ai-client] starting SSE stream processing`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        const decoder = new TextDecoder();
        let finalImages: string[] = [];
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (value) {
                const chunkText = decoder.decode(value, { stream: true });
                console.log(`[ai-client] received chunk (${value.length} bytes)`);
                buffer += chunkText;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    await processLine(line);
                }
            }

            if (done) {
                console.log(`[ai-client] SSE stream reader done`);
                break;
            }
        }

        // Process any remaining content in buffer
        if (buffer.trim()) {
            await processLine(buffer);
        }

        async function processLine(line: string) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) return;

            const dataStr = trimmed.substring(5).trim();
            try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                    await onStream!({ text: data.text });
                }
                if (data.images) {
                    finalImages = data.images;
                    await onStream!({ images: data.images });
                }
            } catch { /* ignore parsing errors */ }
        }

        return { images: finalImages, metadata: { isStream: true } };
    }

    return await response.json();
}
