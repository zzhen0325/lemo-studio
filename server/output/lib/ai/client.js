"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
exports.describeImage = describeImage;
exports.generateImage = generateImage;
const api_base_1 = require("../api-base");
async function generateText(params) {
    const response = await fetch(`${(0, api_base_1.getApiBase)()}/ai/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
        }
        catch { }
        throw new Error(errorMsg);
    }
    return await response.json();
}
async function describeImage(params) {
    const response = await fetch(`${(0, api_base_1.getApiBase)()}/ai/describe`, {
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
        }
        catch { }
        throw new Error(errorMsg);
    }
    return await response.json();
}
async function generateImage(params, onStream) {
    const response = await fetch(`${(0, api_base_1.getApiBase)()}/ai/image`, {
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
        }
        catch { }
        throw new Error(errorMsg);
    }
    const contentType = response.headers.get('Content-Type');
    console.log(`[ai-client] response status: ${response.status}, contentType: ${contentType}`);
    if (contentType?.includes('text/event-stream') && onStream) {
        console.log(`[ai-client] starting SSE stream processing`);
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('Response body is not readable');
        const decoder = new TextDecoder();
        let finalImages = [];
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
        async function processLine(line) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:'))
                return;
            const dataStr = trimmed.substring(5).trim();
            try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                    await onStream({ text: data.text });
                }
                if (data.images) {
                    finalImages = data.images;
                    await onStream({ images: data.images });
                }
            }
            catch { /* ignore parsing errors */ }
        }
        return { images: finalImages, metadata: { isStream: true } };
    }
    return await response.json();
}
